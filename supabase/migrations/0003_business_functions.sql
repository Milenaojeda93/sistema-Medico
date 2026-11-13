-- Medvia · Lógica de negocio (RPC)

-- ============ VISTA: estado efectivo de seguros ============
create or replace function public.insurance_effective_status(p_status public.insurance_status, p_start date, p_end date, p_at date default current_date)
returns public.insurance_status language sql immutable set search_path = public as $$
  select case
    when p_status = 'suspendido' then 'suspendido'::public.insurance_status
    when p_status = 'vencido' or (p_end is not null and p_end < p_at) then 'vencido'::public.insurance_status
    when p_start > p_at then 'suspendido'::public.insurance_status
    else 'activo'::public.insurance_status end;
$$;

create or replace view public.v_patient_insurances with (security_invoker = true) as
select pi.*,
  public.insurance_effective_status(pi.status, pi.start_date, pi.end_date) as effective_status,
  i.trade_name as insurer_name, p.name as plan_name,
  pa.first_name || ' ' || pa.last_name as patient_name, pa.document as patient_document
from public.patient_insurances pi
join public.insurers i on i.id = pi.insurer_id
join public.insurance_plans p on p.id = pi.plan_id
join public.patients pa on pa.id = pi.patient_id;

-- ============ ONBOARDING ============
create or replace function public.create_clinic(
  p_name text, p_ruc text default null, p_phone text default null, p_email text default null,
  p_city text default null, p_address text default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_id uuid; v_room uuid; v_spec uuid;
begin
  if auth.uid() is null then raise exception 'Debés iniciar sesión'; end if;
  if coalesce(trim(p_name),'') = '' then raise exception 'El nombre de la institución es obligatorio'; end if;

  insert into public.clinics(name, ruc, phone, email, city, address, created_by, subscription_ends_at)
  values (trim(p_name), p_ruc, p_phone, p_email, p_city, p_address, auth.uid(), current_date + 30)
  returning id into v_id;

  insert into public.clinic_members(clinic_id, user_id, role) values (v_id, auth.uid(), 'admin_clinica');
  perform public.seed_role_permissions(v_id);

  insert into public.rooms(clinic_id, name) values (v_id, 'Consultorio 1'), (v_id, 'Consultorio 2') ;
  insert into public.specialties(clinic_id, name)
  select v_id, s from unnest(array['Clínica médica','Pediatría','Ginecología','Cardiología','Traumatología','Dermatología']) s;

  select id into v_spec from public.specialties where clinic_id = v_id and name = 'Clínica médica';
  insert into public.services(clinic_id, code, name, category, specialty_id, price) values
    (v_id, 'CON-01', 'Consulta clínica médica', 'consulta', v_spec, 300000),
    (v_id, 'CON-02', 'Consulta de especialidad', 'consulta', null, 350000),
    (v_id, 'LAB-01', 'Hemograma completo', 'laboratorio', null, 80000),
    (v_id, 'RX-01', 'Radiografía simple', 'radiografia', null, 180000),
    (v_id, 'ECO-01', 'Ecografía abdominal', 'ecografia', null, 250000),
    (v_id, 'PRO-01', 'Curación / procedimiento menor', 'procedimiento', null, 120000);
  return v_id;
end $$;

-- ============ USUARIOS DE LA CLÍNICA ============
create or replace function public.clinic_add_user(
  p_clinic uuid, p_email text, p_full_name text, p_role public.clinic_role, p_password text default null)
returns uuid language plpgsql security definer set search_path = public, auth, extensions as $$
declare
  v_uid uuid; v_email text := lower(trim(p_email)); v_my_role public.clinic_role;
begin
  perform public.require_perm(p_clinic, 'usuarios', 'create');
  select role into v_my_role from public.clinic_members where clinic_id = p_clinic and user_id = auth.uid();
  if p_role = 'admin_clinica' and v_my_role <> 'admin_clinica' then
    raise exception 'Solo un Administrador de clínica puede asignar ese rol';
  end if;

  select id into v_uid from auth.users where lower(email) = v_email;
  if v_uid is null then
    if p_password is null or length(p_password) < 8 then
      raise exception 'El usuario no existe: indicá una contraseña inicial de al menos 8 caracteres';
    end if;
    v_uid := gen_random_uuid();
    insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, recovery_token,
      email_change_token_new, email_change)
    values ('00000000-0000-0000-0000-000000000000', v_uid, 'authenticated', 'authenticated', v_email,
      crypt(p_password, gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}',
      jsonb_build_object('full_name', p_full_name), now(), now(), '', '', '', '');
    insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
    values (gen_random_uuid(), v_uid, v_uid::text, jsonb_build_object('sub', v_uid::text, 'email', v_email, 'email_verified', true),
      'email', now(), now(), now());
  end if;

  insert into public.clinic_members(clinic_id, user_id, role) values (p_clinic, v_uid, p_role)
  on conflict (clinic_id, user_id) do update set role = excluded.role, active = true;
  update public.profiles set full_name = coalesce(nullif(p_full_name,''), full_name) where id = v_uid;
  return v_uid;
end $$;

create or replace function public.clinic_users(p_clinic uuid)
returns table (member_id uuid, user_id uuid, full_name text, email text, role public.clinic_role, active boolean,
  created_at timestamptz, last_sign_in_at timestamptz)
language plpgsql stable security definer set search_path = public, auth as $$
begin
  perform public.require_perm(p_clinic, 'usuarios', 'view');
  return query
  select m.id, m.user_id, p.full_name, u.email::text, m.role, m.active, m.created_at, u.last_sign_in_at
  from public.clinic_members m
  join auth.users u on u.id = m.user_id
  left join public.profiles p on p.id = m.user_id
  where m.clinic_id = p_clinic
  order by p.full_name;
end $$;

-- ============ COBERTURA ============
create or replace function public.compute_coverage(
  p_patient_insurance uuid, p_service uuid, p_unit_price numeric, p_quantity int default 1, p_at date default current_date)
returns table (covered boolean, coverage_percent numeric, copay numeric, insurer_amount numeric, patient_amount numeric,
  requires_authorization boolean, authorization_id uuid, note text)
language plpgsql stable security definer set search_path = public as $$
declare
  v_pi public.patient_insurances; v_svc public.services; v_cov public.plan_coverages;
  v_line numeric := round(p_unit_price * p_quantity, 0);
  v_used int; v_auth uuid; v_copay numeric; v_patient numeric; v_insurer numeric; v_status public.insurance_status;
begin
  select * into v_svc from public.services where id = p_service;
  if v_svc.id is null then raise exception 'Servicio inexistente'; end if;
  if not public.is_member(v_svc.clinic_id) then raise exception 'Sin acceso' using errcode = '42501'; end if;

  if p_patient_insurance is null then
    return query select false, 0::numeric, 0::numeric, 0::numeric, v_line, false, null::uuid, 'Atención particular'::text;
    return;
  end if;

  select * into v_pi from public.patient_insurances where id = p_patient_insurance and clinic_id = v_svc.clinic_id;
  if v_pi.id is null then raise exception 'Seguro del paciente inexistente'; end if;

  v_status := public.insurance_effective_status(v_pi.status, v_pi.start_date, v_pi.end_date, p_at);
  if v_status <> 'activo' then
    return query select false, 0::numeric, 0::numeric, 0::numeric, v_line, false, null::uuid,
      ('Seguro ' || v_status::text || ': la prestación corre por cuenta del paciente')::text;
    return;
  end if;

  select c.* into v_cov from public.plan_coverages c
  where c.plan_id = v_pi.plan_id and c.category = v_svc.category
    and (c.specialty_id is null or c.specialty_id = v_svc.specialty_id)
  order by c.specialty_id nulls last limit 1;

  if v_cov.id is null then
    return query select false, 0::numeric, 0::numeric, 0::numeric, v_line, false, null::uuid,
      ('El plan no contempla la categoría "' || v_svc.category::text || '"')::text;
    return;
  end if;
  if not v_cov.covered then
    return query select false, 0::numeric, 0::numeric, 0::numeric, v_line, false, null::uuid, 'Prestación excluida por el plan'::text;
    return;
  end if;

  if v_cov.annual_quantity_limit is not null then
    select coalesce(sum(ii.quantity),0) into v_used
    from public.invoice_items ii join public.invoices inv on inv.id = ii.invoice_id
    where inv.patient_insurance_id = v_pi.id and inv.status <> 'anulada' and ii.covered
      and ii.category = v_svc.category and date_trunc('year', inv.issue_date) = date_trunc('year', p_at);
    if v_used + p_quantity > v_cov.annual_quantity_limit then
      return query select false, 0::numeric, 0::numeric, 0::numeric, v_line, v_cov.requires_authorization, null::uuid,
        format('Límite anual alcanzado (%s de %s usados)', v_used, v_cov.annual_quantity_limit);
      return;
    end if;
  end if;

  if v_cov.requires_authorization then
    select a.id into v_auth from public.authorizations a
    where a.patient_insurance_id = v_pi.id and a.status = 'aprobada'
      and (a.service_id = v_svc.id or a.service_id is null)
      and (a.valid_until is null or a.valid_until >= p_at)
      and not exists (select 1 from public.invoice_items ii join public.invoices inv on inv.id = ii.invoice_id
                      where ii.authorization_id = a.id and inv.status <> 'anulada')
    order by (a.service_id is null), a.response_date desc nulls last limit 1;
    if v_auth is null then
      return query select false, 0::numeric, 0::numeric, 0::numeric, v_line, true, null::uuid,
        'Requiere autorización aprobada de la aseguradora'::text;
      return;
    end if;
  end if;

  v_copay := least(v_line, v_cov.copay * p_quantity);
  v_patient := v_copay + round((v_line - v_copay) * (100 - v_cov.coverage_percent) / 100, 0);
  v_insurer := v_line - v_patient;
  if v_cov.max_amount is not null and v_insurer > v_cov.max_amount * p_quantity then
    v_insurer := v_cov.max_amount * p_quantity;
    v_patient := v_line - v_insurer;
  end if;

  return query select true, v_cov.coverage_percent, v_copay, v_insurer, v_patient, v_cov.requires_authorization, v_auth,
    format('Cubre %s%%%s', trim(to_char(v_cov.coverage_percent, 'FM990.##')), case when v_copay > 0 then ' + copago' else '' end);
end $$;

-- ============ FACTURACIÓN ============
create or replace function public.create_invoice(
  p_clinic uuid, p_patient uuid, p_patient_insurance uuid, p_items jsonb,
  p_discount numeric default 0, p_appointment uuid default null, p_consultation uuid default null, p_notes text default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_id uuid; v_seq int; v_item jsonb; v_svc public.services; v_cov record;
  v_price numeric; v_qty int; v_sub numeric := 0; v_ins numeric := 0; v_pat numeric := 0;
  v_insurer uuid;
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

  for v_item in select * from jsonb_array_elements(p_items) loop
    select * into v_svc from public.services where id = (v_item->>'service_id')::uuid and clinic_id = p_clinic;
    if v_svc.id is null then raise exception 'Servicio inválido'; end if;
    v_qty := greatest(coalesce((v_item->>'quantity')::int, 1), 1);
    v_price := coalesce((v_item->>'unit_price')::numeric, v_svc.price);
    if v_price < 0 then raise exception 'Precio inválido'; end if;
    select * into v_cov from public.compute_coverage(p_patient_insurance, v_svc.id, v_price, v_qty);
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
end $$;

create or replace function public.register_payment(
  p_invoice uuid, p_amount numeric, p_method public.payment_method, p_reference text default null,
  p_is_refund boolean default false, p_notes text default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_inv public.invoices; v_id uuid; v_paid numeric; v_amount numeric;
begin
  select * into v_inv from public.invoices where id = p_invoice for update;
  if v_inv.id is null then raise exception 'Factura inexistente'; end if;
  perform public.require_perm(v_inv.clinic_id, 'caja', 'create');
  if v_inv.status = 'anulada' then raise exception 'La factura está anulada'; end if;
  if p_amount is null or p_amount <= 0 then raise exception 'El importe debe ser mayor a cero'; end if;

  if p_is_refund then
    if p_amount > v_inv.patient_paid then raise exception 'La devolución supera lo cobrado'; end if;
    v_amount := -p_amount;
  else
    if p_amount > v_inv.patient_amount - v_inv.patient_paid then
      raise exception 'El importe supera el saldo pendiente (%)', v_inv.patient_amount - v_inv.patient_paid;
    end if;
    v_amount := p_amount;
  end if;

  insert into public.payments(clinic_id, invoice_id, amount, method, reference, is_refund, notes, received_by)
  values (v_inv.clinic_id, v_inv.id, v_amount, p_method, p_reference, p_is_refund, p_notes, auth.uid())
  returning id into v_id;

  select coalesce(sum(amount),0) into v_paid from public.payments where invoice_id = v_inv.id;
  update public.invoices set patient_paid = v_paid,
    status = case when v_paid >= patient_amount then 'pagada' when v_paid > 0 then 'parcial' else 'pendiente' end::public.invoice_status
  where id = v_inv.id;
  return v_id;
end $$;

create or replace function public.void_invoice(p_invoice uuid, p_reason text)
returns void language plpgsql security definer set search_path = public as $$
declare v_inv public.invoices;
begin
  select * into v_inv from public.invoices where id = p_invoice;
  perform public.require_perm(v_inv.clinic_id, 'facturacion', 'delete');
  if exists (select 1 from public.settlement_items si join public.invoice_items ii on ii.id = si.invoice_item_id
             where ii.invoice_id = p_invoice) then
    raise exception 'La factura está incluida en una liquidación a aseguradora';
  end if;
  if v_inv.patient_paid > 0 then raise exception 'Registrá primero la devolución de lo cobrado'; end if;
  update public.invoices set status = 'anulada', notes = coalesce(notes || E'\n','') || 'Anulada: ' || p_reason where id = p_invoice;
end $$;

-- ============ LIQUIDACIONES A ASEGURADORAS ============
create or replace function public.recalc_settlement(p_settlement uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_claimed numeric; v_rejected numeric; v_paid numeric; v_status public.settlement_status;
begin
  select coalesce(sum(amount),0), coalesce(sum(rejected_amount),0) into v_claimed, v_rejected
  from public.settlement_items where settlement_id = p_settlement;
  select coalesce(sum(amount),0) into v_paid from public.insurer_payments where settlement_id = p_settlement;
  select status into v_status from public.insurer_settlements where id = p_settlement;
  if v_paid > 0 then
    v_status := case when v_paid >= v_claimed - v_rejected then 'pagada' else 'pagada_parcial' end;
  elsif v_claimed > 0 and v_rejected >= v_claimed then
    v_status := 'rechazada';
  elsif v_status = 'rechazada' then
    v_status := 'presentada';
  end if;
  update public.insurer_settlements set total_claimed = v_claimed, total_rejected = v_rejected, total_paid = v_paid, status = v_status
  where id = p_settlement;
end $$;

create or replace function public.create_settlement(p_clinic uuid, p_insurer uuid, p_start date, p_end date, p_notes text default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_seq int; v_count int;
begin
  perform public.require_perm(p_clinic, 'facturacion', 'create');
  if not exists (select 1 from public.insurers where id = p_insurer and clinic_id = p_clinic) then raise exception 'Aseguradora inválida'; end if;
  update public.clinics set settlement_seq = settlement_seq + 1 where id = p_clinic returning settlement_seq into v_seq;
  insert into public.insurer_settlements(clinic_id, insurer_id, number, period_start, period_end, notes, created_by)
  values (p_clinic, p_insurer, 'LIQ-' || lpad(v_seq::text, 5, '0'), p_start, p_end, p_notes, auth.uid())
  returning id into v_id;

  insert into public.settlement_items(clinic_id, settlement_id, invoice_item_id, amount)
  select p_clinic, v_id, ii.id, ii.insurer_amount
  from public.invoice_items ii join public.invoices inv on inv.id = ii.invoice_id
  where inv.clinic_id = p_clinic and inv.insurer_id = p_insurer and inv.status <> 'anulada'
    and inv.issue_date between p_start and p_end and ii.insurer_amount > 0
    and not exists (select 1 from public.settlement_items s where s.invoice_item_id = ii.id);
  get diagnostics v_count = row_count;
  if v_count = 0 then raise exception 'No hay prestaciones pendientes de liquidar para esa aseguradora y período'; end if;
  perform public.recalc_settlement(v_id);
  return v_id;
end $$;

create or replace function public.submit_settlement(p_settlement uuid, p_external_number text)
returns void language plpgsql security definer set search_path = public as $$
declare v_clinic uuid;
begin
  select clinic_id into v_clinic from public.insurer_settlements where id = p_settlement;
  perform public.require_perm(v_clinic, 'facturacion', 'edit');
  update public.insurer_settlements set status = 'presentada', external_invoice_number = p_external_number,
    submitted_at = current_date where id = p_settlement and status = 'borrador';
end $$;

create or replace function public.reject_settlement_item(p_item uuid, p_amount numeric, p_reason text)
returns void language plpgsql security definer set search_path = public as $$
declare v_it public.settlement_items;
begin
  select * into v_it from public.settlement_items where id = p_item;
  perform public.require_perm(v_it.clinic_id, 'facturacion', 'edit');
  if p_amount < 0 or p_amount > v_it.amount then raise exception 'Importe de rechazo inválido'; end if;
  if coalesce(trim(p_reason),'') = '' and p_amount > 0 then raise exception 'Indicá el motivo del rechazo'; end if;
  update public.settlement_items set rejected_amount = p_amount, rejection_reason = nullif(p_reason,''),
    status = case when p_amount = 0 then 'aprobado' else 'rechazado' end::public.settlement_item_status
  where id = p_item;
  perform public.recalc_settlement(v_it.settlement_id);
end $$;

create or replace function public.register_insurer_payment(p_settlement uuid, p_amount numeric, p_date date, p_reference text)
returns void language plpgsql security definer set search_path = public as $$
declare v_s public.insurer_settlements;
begin
  select * into v_s from public.insurer_settlements where id = p_settlement;
  perform public.require_perm(v_s.clinic_id, 'facturacion', 'edit');
  if v_s.status = 'borrador' then raise exception 'Presentá la liquidación antes de registrar pagos'; end if;
  if p_amount <= 0 or p_amount > v_s.total_claimed - v_s.total_rejected - v_s.total_paid then
    raise exception 'El importe supera el saldo pendiente de la liquidación';
  end if;
  insert into public.insurer_payments(clinic_id, settlement_id, amount, paid_at, reference, created_by)
  values (v_s.clinic_id, p_settlement, p_amount, coalesce(p_date, current_date), p_reference, auth.uid());
  perform public.recalc_settlement(p_settlement);
end $$;

-- ============ HISTORIA CLÍNICA ============
create or replace function public.close_consultation(p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_c public.consultations;
begin
  select * into v_c from public.consultations where id = p_id;
  perform public.require_perm(v_c.clinic_id, 'historias', 'edit');
  if v_c.status = 'cerrada' then return; end if;
  if coalesce(trim(v_c.diagnosis),'') = '' then raise exception 'Registrá el diagnóstico antes de cerrar la consulta'; end if;
  update public.consultations set status = 'cerrada', closed_at = now(), closed_by = auth.uid() where id = p_id;
  if v_c.appointment_id is not null then
    update public.appointments set status = 'atendida' where id = v_c.appointment_id;
  end if;
end $$;

create or replace function public.amend_consultation(p_id uuid, p_field text, p_new_value text, p_reason text)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_c public.consultations; v_old text;
  allowed text[] := array['reason','symptoms','background','diagnosis','diagnosis_code','observations','treatment','instructions','evolution'];
begin
  select * into v_c from public.consultations where id = p_id;
  perform public.require_perm(v_c.clinic_id, 'historias', 'edit');
  if not (p_field = any(allowed)) then raise exception 'Campo no enmendable'; end if;
  if coalesce(trim(p_reason),'') = '' then raise exception 'El motivo de la enmienda es obligatorio'; end if;
  execute format('select ($1).%I::text', p_field) into v_old using v_c;
  perform set_config('app.amending', 'on', true);
  execute format('update public.consultations set %I = $1 where id = $2', p_field) using p_new_value, p_id;
  perform set_config('app.amending', 'off', true);
  insert into public.consultation_amendments(clinic_id, consultation_id, field, old_value, new_value, reason, created_by)
  values (v_c.clinic_id, p_id, p_field, v_old, p_new_value, p_reason, auth.uid());
end $$;

-- ============ DASHBOARD ============
create or replace function public.dashboard_stats(p_clinic uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_tz text; v_today date; v_month date; r jsonb;
begin
  perform public.require_perm(p_clinic, 'dashboard', 'view');
  select timezone into v_tz from public.clinics where id = p_clinic;
  v_today := (now() at time zone v_tz)::date;
  v_month := date_trunc('month', v_today)::date;

  select jsonb_build_object(
    'total_patients', (select count(*) from patients where clinic_id = p_clinic and not archived),
    'new_patients_month', (select count(*) from patients where clinic_id = p_clinic and (created_at at time zone v_tz)::date >= v_month),
    'consultations_today', (select count(*) from consultations where clinic_id = p_clinic and (consulted_at at time zone v_tz)::date = v_today),
    'appointments_today', (select count(*) from appointments where clinic_id = p_clinic and (starts_at at time zone v_tz)::date = v_today and status not in ('cancelada')),
    'pending_appointments', (select count(*) from appointments where clinic_id = p_clinic and (starts_at at time zone v_tz)::date >= v_today and status = 'pendiente'),
    'confirmed_appointments', (select count(*) from appointments where clinic_id = p_clinic and (starts_at at time zone v_tz)::date >= v_today and status = 'confirmada'),
    'available_doctors', (select count(distinct d.id) from doctors d join doctor_schedules s on s.doctor_id = d.id
                          where d.clinic_id = p_clinic and d.active and s.weekday = extract(dow from v_today)),
    'active_doctors', (select count(*) from doctors where clinic_id = p_clinic and active),
    'consultations_month', (select count(*) from consultations where clinic_id = p_clinic and (consulted_at at time zone v_tz)::date >= v_month),
    'income_today', (select coalesce(sum(amount),0) from payments where clinic_id = p_clinic and (paid_at at time zone v_tz)::date = v_today)
                    + (select coalesce(sum(ip.amount),0) from insurer_payments ip where ip.clinic_id = p_clinic and ip.paid_at = v_today),
    'income_month', (select coalesce(sum(amount),0) from payments where clinic_id = p_clinic and (paid_at at time zone v_tz)::date >= v_month)
                    + (select coalesce(sum(ip.amount),0) from insurer_payments ip where ip.clinic_id = p_clinic and ip.paid_at >= v_month),
    'pending_invoices', (select count(*) from invoices where clinic_id = p_clinic and status in ('pendiente','parcial')),
    'pending_invoices_amount', (select coalesce(sum(patient_amount - patient_paid),0) from invoices where clinic_id = p_clinic and status in ('pendiente','parcial')),
    'insurer_receivable', (select coalesce(sum(i.insurer_amount),0) from invoices i where i.clinic_id = p_clinic and i.status <> 'anulada')
        - (select coalesce(sum(total_rejected + total_paid),0) from insurer_settlements where clinic_id = p_clinic),
    'consultations_by_day', (select coalesce(jsonb_agg(jsonb_build_object('date', d::date, 'total', coalesce(c.n,0)) order by d), '[]')
        from generate_series(v_today - 29, v_today, '1 day') d
        left join (select (consulted_at at time zone v_tz)::date dd, count(*) n from consultations where clinic_id = p_clinic group by 1) c on c.dd = d::date),
    'consultations_by_specialty', (select coalesce(jsonb_agg(jsonb_build_object('name', x.name, 'total', x.n) order by x.n desc), '[]') from (
        select coalesce(s.name,'Sin especialidad') name, count(*) n from consultations c left join specialties s on s.id = c.specialty_id
        where c.clinic_id = p_clinic and c.consulted_at >= now() - interval '90 days' group by 1) x),
    'income_by_month', (select coalesce(jsonb_agg(jsonb_build_object('month', to_char(m,'YYYY-MM'),
          'particular', (select coalesce(sum(p.amount),0) from payments p where p.clinic_id = p_clinic and date_trunc('month', p.paid_at at time zone v_tz) = m),
          'aseguradoras', (select coalesce(sum(ip.amount),0) from insurer_payments ip where ip.clinic_id = p_clinic and date_trunc('month', ip.paid_at) = m)
        ) order by m), '[]')
        from generate_series(date_trunc('month', v_today) - interval '5 months', date_trunc('month', v_today), '1 month') m),
    'new_patients_by_month', (select coalesce(jsonb_agg(jsonb_build_object('month', to_char(m,'YYYY-MM'),
          'total', (select count(*) from patients p where p.clinic_id = p_clinic and date_trunc('month', p.created_at at time zone v_tz) = m)) order by m), '[]')
        from generate_series(date_trunc('month', v_today) - interval '5 months', date_trunc('month', v_today), '1 month') m),
    'care_type_distribution', (select coalesce(jsonb_agg(jsonb_build_object('name', care_type, 'total', n)), '[]') from (
        select care_type, count(*) n from appointments where clinic_id = p_clinic and starts_at >= now() - interval '90 days'
        and status <> 'cancelada' group by 1) x),
    'upcoming', (select coalesce(jsonb_agg(x order by x.starts_at), '[]') from (
        select a.id, a.starts_at, a.status, a.care_type, p.first_name || ' ' || p.last_name patient, d.full_name doctor, s.name specialty
        from appointments a join patients p on p.id = a.patient_id join doctors d on d.id = a.doctor_id
        left join specialties s on s.id = a.specialty_id
        where a.clinic_id = p_clinic and a.starts_at >= now() - interval '30 minutes' and a.status in ('pendiente','confirmada','en_espera')
        order by a.starts_at limit 8) x),
    'activity', (select coalesce(jsonb_agg(x order by x.created_at desc), '[]') from (
        select l.table_name, l.action, l.created_at, coalesce(pr.full_name, 'Sistema') user_name
        from audit_log l left join profiles pr on pr.id = l.user_id
        where l.clinic_id = p_clinic and l.table_name in ('patients','appointments','consultations','invoices','payments','authorizations','patient_insurances')
        order by l.created_at desc limit 10) x)
  ) into r;
  return r;
end $$;

-- ============ SUPERADMIN ============
create or replace function public.admin_clinics()
returns table (id uuid, name text, ruc text, city text, email text, status public.clinic_status, subscription_plan text,
  subscription_ends_at date, created_at timestamptz, users bigint, patients bigint, doctors bigint, last_activity timestamptz)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_platform_admin() then raise exception 'Acceso restringido' using errcode = '42501'; end if;
  return query
  select c.id, c.name, c.ruc, c.city, c.email, c.status, c.subscription_plan, c.subscription_ends_at, c.created_at,
    (select count(*) from clinic_members m where m.clinic_id = c.id),
    (select count(*) from patients p where p.clinic_id = c.id),
    (select count(*) from doctors d where d.clinic_id = c.id),
    (select max(l.created_at) from audit_log l where l.clinic_id = c.id)
  from clinics c order by c.created_at desc;
end $$;

create or replace function public.admin_update_clinic(p_clinic uuid, p_status public.clinic_status, p_plan text, p_ends date)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_platform_admin() then raise exception 'Acceso restringido' using errcode = '42501'; end if;
  update public.clinics set status = p_status, subscription_plan = p_plan, subscription_ends_at = p_ends where id = p_clinic;
end $$;

insert into public.subscription_plans(id, name, monthly_price, max_users, max_doctors) values
  ('basico', 'Básico', 350000, 5, 3),
  ('profesional', 'Profesional', 750000, 15, 10),
  ('institucional', 'Institucional', 1800000, null, null)
on conflict (id) do nothing;

-- Permisos de ejecución
revoke execute on all functions in schema public from public, anon;
grant execute on all functions in schema public to authenticated;
revoke execute on function public.seed_role_permissions(uuid) from authenticated;
revoke execute on function public.recalc_settlement(uuid) from authenticated;
alter default privileges in schema public revoke execute on functions from public, anon;
