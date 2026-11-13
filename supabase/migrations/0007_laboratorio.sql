-- Medvia · Laboratorio y estudios (pedido desde la consulta, carga de resultados con adjuntos)

alter table public.clinics add column if not exists lab_seq int not null default 0;

create table public.lab_orders (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  number text not null,
  patient_id uuid not null references public.patients(id) on delete cascade,
  doctor_id uuid not null references public.doctors(id),
  consultation_id uuid references public.consultations(id),
  priority text not null default 'normal' check (priority in ('normal','urgente')),
  clinical_notes text,
  status text not null default 'solicitado' check (status in ('solicitado','en_proceso','completado','anulado')),
  void_reason text,
  ordered_at timestamptz not null default now(),
  completed_at timestamptz,
  created_by uuid references auth.users(id),
  unique (clinic_id, number)
);
create index on public.lab_orders(clinic_id, ordered_at desc);
create index on public.lab_orders(patient_id);
create index on public.lab_orders(consultation_id);

create table public.lab_order_items (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  order_id uuid not null references public.lab_orders(id) on delete cascade,
  position int not null default 0,
  study text not null,
  category text not null default 'laboratorio' check (category in ('laboratorio','imagen','otro')),
  status text not null default 'pendiente' check (status in ('pendiente','completado')),
  result text,
  result_file_path text,
  result_file_name text,
  result_by uuid references auth.users(id),
  result_at timestamptz
);
create index on public.lab_order_items(order_id);

create trigger chk_lab before insert or update on public.lab_orders for each row
  execute function public.enforce_same_clinic('patient_id','patients','doctor_id','doctors','consultation_id','consultations');
create trigger chk_lab_items before insert or update on public.lab_order_items for each row
  execute function public.enforce_same_clinic('order_id','lab_orders');
create trigger audit_lab_orders after insert or update or delete on public.lab_orders
  for each row execute function public.audit_trigger();
create trigger audit_lab_order_items after insert or update or delete on public.lab_order_items
  for each row execute function public.audit_trigger();

alter table public.lab_orders enable row level security;
alter table public.lab_order_items enable row level security;
create policy lab_orders_sel on public.lab_orders for select to authenticated
  using (public.has_perm(clinic_id, 'laboratorio', 'view'));
create policy lab_order_items_sel on public.lab_order_items for select to authenticated
  using (public.has_perm(clinic_id, 'laboratorio', 'view'));
-- Las escrituras se hacen solo con las funciones de abajo (numeración, estados y trazabilidad).

create or replace function public.create_lab_order(
  p_clinic uuid, p_patient uuid, p_doctor uuid, p_items jsonb,
  p_consultation uuid default null, p_priority text default 'normal', p_notes text default null)
returns uuid language plpgsql security definer set search_path = public as $fn$
declare
  v_id uuid; v_seq int; v_item jsonb; v_pos int := 0;
begin
  perform public.require_perm(p_clinic, 'laboratorio', 'create');
  if not exists (select 1 from public.patients where id = p_patient and clinic_id = p_clinic) then raise exception 'Paciente inválido'; end if;
  if not exists (select 1 from public.doctors where id = p_doctor and clinic_id = p_clinic) then raise exception 'Profesional inválido'; end if;
  if p_consultation is not null and not exists (
    select 1 from public.consultations where id = p_consultation and clinic_id = p_clinic and patient_id = p_patient) then
    raise exception 'La consulta no corresponde al paciente';
  end if;
  if jsonb_array_length(coalesce(p_items, '[]'::jsonb)) = 0 then raise exception 'Agregá al menos un estudio'; end if;
  if jsonb_array_length(p_items) > 40 then raise exception 'Demasiados estudios en un pedido'; end if;

  update public.clinics set lab_seq = lab_seq + 1 where id = p_clinic returning lab_seq into v_seq;
  insert into public.lab_orders(clinic_id, number, patient_id, doctor_id, consultation_id, priority, clinical_notes, created_by)
  values (p_clinic, 'L-' || lpad(v_seq::text, 6, '0'), p_patient, p_doctor, p_consultation,
          case when p_priority = 'urgente' then 'urgente' else 'normal' end, nullif(trim(p_notes), ''), auth.uid())
  returning id into v_id;

  for v_item in select * from jsonb_array_elements(p_items) loop
    if coalesce(trim(v_item->>'study'), '') = '' then raise exception 'Cada estudio necesita un nombre'; end if;
    insert into public.lab_order_items(clinic_id, order_id, position, study, category)
    values (p_clinic, v_id, v_pos, left(trim(v_item->>'study'), 200),
            case when v_item->>'category' in ('laboratorio','imagen','otro') then v_item->>'category' else 'laboratorio' end);
    v_pos := v_pos + 1;
  end loop;
  return v_id;
end $fn$;

create or replace function public.save_lab_result(
  p_item uuid, p_result text, p_complete boolean default true,
  p_file_path text default null, p_file_name text default null)
returns void language plpgsql security definer set search_path = public as $fn$
declare
  v_item public.lab_order_items; v_order public.lab_orders; v_pending int;
begin
  select * into v_item from public.lab_order_items where id = p_item;
  if v_item.id is null then raise exception 'Estudio inválido'; end if;
  perform public.require_perm(v_item.clinic_id, 'laboratorio', 'edit');
  select * into v_order from public.lab_orders where id = v_item.order_id;
  if v_order.status = 'anulado' then raise exception 'El pedido está anulado'; end if;
  if p_file_path is not null and p_file_path not like v_item.clinic_id::text || '/laboratorio/%' then
    raise exception 'Ruta de archivo inválida';
  end if;
  if p_complete and coalesce(trim(p_result), '') = '' and coalesce(p_file_path, v_item.result_file_path) is null then
    raise exception 'Cargá el resultado o adjuntá un archivo para completar el estudio';
  end if;

  update public.lab_order_items set
    result = nullif(trim(p_result), ''),
    result_file_path = coalesce(p_file_path, result_file_path),
    result_file_name = coalesce(p_file_name, result_file_name),
    status = case when p_complete then 'completado' else 'pendiente' end,
    result_by = auth.uid(), result_at = now()
  where id = p_item;

  select count(*) into v_pending from public.lab_order_items where order_id = v_order.id and status = 'pendiente';
  update public.lab_orders set
    status = case when v_pending = 0 then 'completado' else 'en_proceso' end,
    completed_at = case when v_pending = 0 then now() else null end
  where id = v_order.id;
end $fn$;

create or replace function public.void_lab_order(p_order uuid, p_reason text)
returns void language plpgsql security definer set search_path = public as $fn$
declare v_order public.lab_orders;
begin
  select * into v_order from public.lab_orders where id = p_order;
  if v_order.id is null then raise exception 'Pedido inválido'; end if;
  perform public.require_perm(v_order.clinic_id, 'laboratorio', 'edit');
  if v_order.status = 'completado' then raise exception 'Un pedido completado no puede anularse'; end if;
  if coalesce(trim(p_reason), '') = '' then raise exception 'Indicá el motivo de la anulación'; end if;
  update public.lab_orders set status = 'anulado', void_reason = trim(p_reason) where id = p_order;
end $fn$;

-- Archivos de resultados: <clínica>/laboratorio/<pedido>/<archivo> en el bucket privado "documentos"
create policy lab_docs_read on storage.objects for select to authenticated
  using (bucket_id = 'documentos' and (storage.foldername(name))[2] = 'laboratorio'
         and public.has_perm(((storage.foldername(name))[1])::uuid, 'laboratorio', 'view'));
create policy lab_docs_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'documentos' and (storage.foldername(name))[2] = 'laboratorio'
              and public.has_perm(((storage.foldername(name))[1])::uuid, 'laboratorio', 'edit'));

revoke execute on function public.create_lab_order(uuid, uuid, uuid, jsonb, uuid, text, text) from public, anon;
grant execute on function public.create_lab_order(uuid, uuid, uuid, jsonb, uuid, text, text) to authenticated;
revoke execute on function public.save_lab_result(uuid, text, boolean, text, text) from public, anon;
grant execute on function public.save_lab_result(uuid, text, boolean, text, text) to authenticated;
revoke execute on function public.void_lab_order(uuid, text) from public, anon;
grant execute on function public.void_lab_order(uuid, text) to authenticated;
