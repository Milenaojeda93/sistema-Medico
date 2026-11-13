-- Medvia · Seguros que atiende cada profesional y su porcentaje de cobertura convenido.
-- Regla: si el profesional no tiene seguros cargados, atiende todos con la cobertura del plan.
-- Si tiene alguno cargado, sólo atiende esos. El % y copago propios (opcionales) reemplazan
-- a los del plan en las consultas con ese profesional.

create table if not exists public.doctor_insurances (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  doctor_id uuid not null references public.doctors(id) on delete cascade,
  insurer_id uuid not null references public.insurers(id) on delete cascade,
  plan_id uuid references public.insurance_plans(id) on delete cascade,
  coverage_percent numeric(5,2) check (coverage_percent between 0 and 100),
  copay numeric(14,2) check (copay >= 0),
  notes text,
  created_at timestamptz not null default now()
);
create unique index if not exists doctor_insurances_uniq on public.doctor_insurances
  (doctor_id, insurer_id, coalesce(plan_id, '00000000-0000-0000-0000-000000000000'::uuid));
create index if not exists doctor_insurances_doctor on public.doctor_insurances(doctor_id);

drop trigger if exists chk_doctor_insurances on public.doctor_insurances;
create trigger chk_doctor_insurances before insert or update on public.doctor_insurances for each row
  execute function public.enforce_same_clinic('doctor_id','doctors','insurer_id','insurers','plan_id','insurance_plans');
drop trigger if exists audit_doctor_insurances on public.doctor_insurances;
create trigger audit_doctor_insurances after insert or update or delete on public.doctor_insurances
  for each row execute function public.audit_trigger();

alter table public.doctor_insurances enable row level security;
drop policy if exists doctor_insurances_sel on public.doctor_insurances;
drop policy if exists doctor_insurances_ins on public.doctor_insurances;
drop policy if exists doctor_insurances_upd on public.doctor_insurances;
drop policy if exists doctor_insurances_del on public.doctor_insurances;
create policy doctor_insurances_sel on public.doctor_insurances for select to authenticated using (public.is_member(clinic_id));
create policy doctor_insurances_ins on public.doctor_insurances for insert to authenticated with check (public.has_perm(clinic_id, 'medicos', 'create') or public.has_perm(clinic_id, 'medicos', 'edit'));
create policy doctor_insurances_upd on public.doctor_insurances for update to authenticated using (public.has_perm(clinic_id, 'medicos', 'edit')) with check (public.has_perm(clinic_id, 'medicos', 'edit'));
create policy doctor_insurances_del on public.doctor_insurances for delete to authenticated using (public.has_perm(clinic_id, 'medicos', 'edit'));

-- Cobertura teniendo en cuenta al profesional
create or replace function public.compute_coverage_doctor(
  p_patient_insurance uuid, p_service uuid, p_unit_price numeric, p_quantity int, p_doctor uuid, p_at date default current_date)
returns table (covered boolean, coverage_percent numeric, copay numeric, insurer_amount numeric, patient_amount numeric,
  requires_authorization boolean, authorization_id uuid, note text)
language plpgsql stable security definer set search_path = public as $fn$
declare
  r record; v_pi public.patient_insurances; v_svc public.services; v_di public.doctor_insurances;
  v_line numeric := round(p_unit_price * p_quantity, 0); v_copay numeric; v_patient numeric;
begin
  select * into r from public.compute_coverage(p_patient_insurance, p_service, p_unit_price, p_quantity, p_at);
  if p_doctor is null or p_patient_insurance is null
     or not exists (select 1 from public.doctor_insurances where doctor_id = p_doctor) then
    return query select r.covered, r.coverage_percent, r.copay, r.insurer_amount, r.patient_amount, r.requires_authorization, r.authorization_id, r.note;
    return;
  end if;

  select * into v_pi from public.patient_insurances where id = p_patient_insurance;
  select * into v_svc from public.services where id = p_service;
  select * into v_di from public.doctor_insurances
  where doctor_id = p_doctor and insurer_id = v_pi.insurer_id and (plan_id is null or plan_id = v_pi.plan_id)
  order by plan_id nulls last limit 1;

  if v_di.id is null then
    return query select false, 0::numeric, 0::numeric, 0::numeric, v_line, false, null::uuid,
      'El profesional no atiende por este seguro: corre por cuenta del paciente'::text;
    return;
  end if;

  -- Sin % propio, o no es consulta, o el seguro no está activo / falta autorización / límite: vale la regla del plan.
  if v_di.coverage_percent is null or v_svc.category <> 'consulta'
     or public.insurance_effective_status(v_pi.status, v_pi.start_date, v_pi.end_date, p_at) <> 'activo'
     or (not r.covered and (r.requires_authorization or r.note like 'Límite%')) then
    return query select r.covered, r.coverage_percent, r.copay, r.insurer_amount, r.patient_amount, r.requires_authorization, r.authorization_id, r.note;
    return;
  end if;

  v_copay := least(v_line, coalesce(v_di.copay, 0) * p_quantity);
  v_patient := v_copay + round((v_line - v_copay) * (100 - v_di.coverage_percent) / 100, 0);
  return query select true, v_di.coverage_percent, v_copay, v_line - v_patient, v_patient, r.requires_authorization, r.authorization_id,
    format('Convenio del profesional: cubre %s%%%s', trim(to_char(v_di.coverage_percent, 'FM990.##')), case when v_copay > 0 then ' + copago' else '' end);
end $fn$;

grant execute on function public.compute_coverage_doctor(uuid, uuid, numeric, int, uuid, date) to authenticated;

-- La factura aplica el convenio del profesional de la cita o consulta
create or replace function public.create_invoice(
  p_clinic uuid, p_patient uuid, p_patient_insurance uuid, p_items jsonb,
  p_discount numeric default 0, p_appointment uuid default null, p_consultation uuid default null, p_notes text default null)
returns uuid language plpgsql security definer set search_path = public as $fn$
declare
  v_id uuid; v_seq int; v_item jsonb; v_svc public.services; v_cov record;
  v_price numeric; v_qty int; v_sub numeric := 0; v_ins numeric := 0; v_pat numeric := 0;
  v_insurer uuid; v_doctor uuid;
begin
  perform public.require_perm(p_clinic, 'facturacion', 'create');
  if not exists (select 1 from public.patients where id = p_patient and clinic_id = p_clinic) then
    raise exception 'Paciente inválido';
  end if;
  if p_patient_insurance is not null then
    select insurer_id into v_insurer from public.patient_insurances
    where id = p_patient_insurance and patient_id = p_patient and clinic_id = p_clinic;
    if v_insurer is null then raise exception 'El seguro no pertenece al paciente'; end if;
  end if;
  if jsonb_array_length(coalesce(p_items,'[]')) = 0 then raise exception 'Agregá al menos un servicio'; end if;

  update public.clinics set invoice_seq = invoice_seq + 1 where id = p_clinic returning invoice_seq into v_seq;
  insert into public.invoices(clinic_id, number, patient_id, care_type, patient_insurance_id, insurer_id,
    appointment_id, consultation_id, notes, created_by)
  values (p_clinic, 'F-' || lpad(v_seq::text, 6, '0'), p_patient,
    case when p_patient_insurance is null then 'particular' else 'seguro' end::public.care_type,
    p_patient_insurance, v_insurer, p_appointment, p_consultation, p_notes, auth.uid())
  returning id into v_id;

  -- Profesional de la atención (para aplicar su convenio con el seguro)
  select coalesce(
    (select doctor_id from public.appointments where id = p_appointment and clinic_id = p_clinic),
    (select doctor_id from public.consultations where id = p_consultation and clinic_id = p_clinic)) into v_doctor;

  for v_item in select * from jsonb_array_elements(p_items) loop
    select * into v_svc from public.services where id = (v_item->>'service_id')::uuid and clinic_id = p_clinic;
    if v_svc.id is null then raise exception 'Servicio inválido'; end if;
    v_qty := greatest(coalesce((v_item->>'quantity')::int, 1), 1);
    v_price := coalesce((v_item->>'unit_price')::numeric, v_svc.price);
    if v_price < 0 then raise exception 'Precio inválido'; end if;
    if v_price <> v_svc.price and not public.has_perm(p_clinic, 'configuracion', 'edit') then
      raise exception 'No tenés permiso para modificar el precio de lista de "%"', v_svc.name;
    end if;
    select * into v_cov from public.compute_coverage_doctor(p_patient_insurance, v_svc.id, v_price, v_qty, v_doctor);
    insert into public.invoice_items(clinic_id, invoice_id, service_id, description, category, quantity, unit_price,
      line_total, covered, coverage_percent, copay, insurer_amount, patient_amount, authorization_id, coverage_note)
    values (p_clinic, v_id, v_svc.id, v_svc.name, v_svc.category, v_qty, v_price, round(v_price*v_qty,0),
      v_cov.covered, v_cov.coverage_percent, v_cov.copay, v_cov.insurer_amount, v_cov.patient_amount,
      v_cov.authorization_id, v_cov.note);
    v_sub := v_sub + round(v_price*v_qty,0); v_ins := v_ins + v_cov.insurer_amount; v_pat := v_pat + v_cov.patient_amount;
  end loop;

  if coalesce(p_discount,0) < 0 or coalesce(p_discount,0) > v_pat then
    raise exception 'El descuento no puede superar el importe a cargo del paciente';
  end if;

  update public.invoices set subtotal = v_sub, discount = coalesce(p_discount,0),
    total = v_sub - coalesce(p_discount,0), insurer_amount = v_ins, patient_amount = v_pat - coalesce(p_discount,0),
    status = case when v_pat - coalesce(p_discount,0) = 0 then 'pagada' else 'pendiente' end::public.invoice_status
  where id = v_id;
  return v_id;
end $fn$;

