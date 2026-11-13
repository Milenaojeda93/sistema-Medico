-- Medvia · Recetas médicas (emitidas desde la consulta)

alter table public.clinics add column if not exists prescription_seq int not null default 0;

create table public.prescriptions (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  number text not null,
  patient_id uuid not null references public.patients(id) on delete cascade,
  doctor_id uuid not null references public.doctors(id),
  consultation_id uuid references public.consultations(id),
  diagnosis text,
  notes text,
  status text not null default 'emitida' check (status in ('emitida','anulada')),
  void_reason text,
  issued_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  unique (clinic_id, number)
);
create index on public.prescriptions(clinic_id, issued_at desc);
create index on public.prescriptions(patient_id);
create index on public.prescriptions(consultation_id);

create table public.prescription_items (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  prescription_id uuid not null references public.prescriptions(id) on delete cascade,
  position int not null default 0,
  drug text not null,
  presentation text,
  dose text,
  frequency text,
  duration text,
  quantity text,
  route text,
  instructions text
);
create index on public.prescription_items(prescription_id);

create trigger chk_rx before insert or update on public.prescriptions for each row
  execute function public.enforce_same_clinic('patient_id','patients','doctor_id','doctors','consultation_id','consultations');
create trigger chk_rx_items before insert or update on public.prescription_items for each row
  execute function public.enforce_same_clinic('prescription_id','prescriptions');

-- Una receta emitida no se modifica: solo puede anularse (con motivo). Los ítems son inmutables.
create or replace function public.protect_prescription()
returns trigger language plpgsql set search_path = public as $fn$
begin
  if tg_op = 'DELETE' then
    -- Permitido solo como cascada al eliminar la institución o el paciente
    if not exists (select 1 from public.clinics where id = old.clinic_id)
       or not exists (select 1 from public.patients where id = old.patient_id) then return old; end if;
    raise exception 'Las recetas no se eliminan; anulalas indicando el motivo';
  end if;
  if old.status = 'anulada' then raise exception 'La receta ya está anulada'; end if;
  if new.status <> 'anulada' or coalesce(trim(new.void_reason), '') = ''
     or (to_jsonb(new) - 'status' - 'void_reason') <> (to_jsonb(old) - 'status' - 'void_reason') then
    raise exception 'Una receta emitida no puede modificarse; solo anularse indicando el motivo';
  end if;
  return new;
end $fn$;
create trigger prescriptions_protect before update or delete on public.prescriptions
  for each row execute function public.protect_prescription();

create or replace function public.protect_prescription_items()
returns trigger language plpgsql set search_path = public as $fn$
begin
  if tg_op = 'DELETE' and not exists (select 1 from public.prescriptions where id = old.prescription_id) then return old; end if;
  raise exception 'Los medicamentos de una receta emitida no pueden modificarse';
end $fn$;
create trigger prescription_items_protect before update or delete on public.prescription_items
  for each row execute function public.protect_prescription_items();

create trigger audit_prescriptions after insert or update or delete on public.prescriptions
  for each row execute function public.audit_trigger();
create trigger audit_prescription_items after insert or update or delete on public.prescription_items
  for each row execute function public.audit_trigger();

alter table public.prescriptions enable row level security;
alter table public.prescription_items enable row level security;

create policy prescriptions_sel on public.prescriptions for select to authenticated
  using (public.has_perm(clinic_id, 'recetas', 'view'));
create policy prescriptions_upd on public.prescriptions for update to authenticated
  using (public.has_perm(clinic_id, 'recetas', 'edit')) with check (public.has_perm(clinic_id, 'recetas', 'edit'));
create policy prescription_items_sel on public.prescription_items for select to authenticated
  using (public.has_perm(clinic_id, 'recetas', 'view'));
-- La creación se hace solo vía create_prescription (numeración correlativa atómica).

create or replace function public.create_prescription(
  p_clinic uuid, p_patient uuid, p_doctor uuid, p_items jsonb,
  p_consultation uuid default null, p_diagnosis text default null, p_notes text default null)
returns uuid language plpgsql security definer set search_path = public as $fn$
declare
  v_id uuid; v_seq int; v_item jsonb; v_pos int := 0;
begin
  perform public.require_perm(p_clinic, 'recetas', 'create');
  if not exists (select 1 from public.patients where id = p_patient and clinic_id = p_clinic) then
    raise exception 'Paciente inválido';
  end if;
  if not exists (select 1 from public.doctors where id = p_doctor and clinic_id = p_clinic) then
    raise exception 'Profesional inválido';
  end if;
  if p_consultation is not null and not exists (
    select 1 from public.consultations where id = p_consultation and clinic_id = p_clinic and patient_id = p_patient) then
    raise exception 'La consulta no corresponde al paciente';
  end if;
  if jsonb_array_length(coalesce(p_items, '[]'::jsonb)) = 0 then raise exception 'Agregá al menos un medicamento'; end if;
  if jsonb_array_length(p_items) > 30 then raise exception 'Demasiados medicamentos en una receta'; end if;

  update public.clinics set prescription_seq = prescription_seq + 1 where id = p_clinic returning prescription_seq into v_seq;
  insert into public.prescriptions(clinic_id, number, patient_id, doctor_id, consultation_id, diagnosis, notes, created_by)
  values (p_clinic, 'R-' || lpad(v_seq::text, 6, '0'), p_patient, p_doctor, p_consultation,
          nullif(trim(p_diagnosis), ''), nullif(trim(p_notes), ''), auth.uid())
  returning id into v_id;

  for v_item in select * from jsonb_array_elements(p_items) loop
    if coalesce(trim(v_item->>'drug'), '') = '' then raise exception 'Cada medicamento necesita un nombre'; end if;
    insert into public.prescription_items(clinic_id, prescription_id, position, drug, presentation, dose, frequency,
      duration, quantity, route, instructions)
    values (p_clinic, v_id, v_pos, left(trim(v_item->>'drug'), 200),
      nullif(trim(v_item->>'presentation'), ''), nullif(trim(v_item->>'dose'), ''), nullif(trim(v_item->>'frequency'), ''),
      nullif(trim(v_item->>'duration'), ''), nullif(trim(v_item->>'quantity'), ''), nullif(trim(v_item->>'route'), ''),
      nullif(trim(v_item->>'instructions'), ''));
    v_pos := v_pos + 1;
  end loop;
  return v_id;
end $fn$;

revoke execute on function public.protect_prescription() from authenticated, public, anon;
revoke execute on function public.protect_prescription_items() from authenticated, public, anon;
revoke execute on function public.create_prescription(uuid, uuid, uuid, jsonb, uuid, text, text) from public, anon;
grant execute on function public.create_prescription(uuid, uuid, uuid, jsonb, uuid, text, text) to authenticated;
