-- Medvia · Estudios que el paciente se hace afuera (laboratorio externo).
-- Un pedido "externo" no es trabajo pendiente del laboratorio de la clínica: queda como indicado
-- hasta que el paciente trae los resultados, y el médico que lo pidió puede adjuntarlos o cerrarlo.

alter table public.lab_orders add column if not exists location text not null default 'interno';
alter table public.lab_orders drop constraint if exists lab_orders_location_check;
alter table public.lab_orders add constraint lab_orders_location_check check (location in ('interno','externo'));
alter table public.lab_orders add column if not exists external_lab text;
create index if not exists lab_orders_location on public.lab_orders(clinic_id, location, status);

-- Quién puede cargar resultados o anular: el laboratorio; y, en pedidos externos, el médico que los pidió.
create or replace function public.require_lab_result_perm(p_order public.lab_orders)
returns void language plpgsql stable security definer set search_path = public as $fn$
begin
  if p_order.id is null then raise exception 'Pedido inválido'; end if;
  if public.has_perm(p_order.clinic_id, 'laboratorio', 'edit') then return; end if;
  if p_order.location = 'externo' and public.has_perm(p_order.clinic_id, 'historias', 'edit')
     and public.sees_doctor(p_order.clinic_id, p_order.doctor_id) then return; end if;
  raise exception 'No tenés permiso para cargar resultados de este pedido';
end $fn$;
revoke execute on function public.require_lab_result_perm(public.lab_orders) from public, anon;

drop function if exists public.create_lab_order(uuid, uuid, uuid, jsonb, uuid, text, text);
create or replace function public.create_lab_order(
  p_clinic uuid, p_patient uuid, p_doctor uuid, p_items jsonb,
  p_consultation uuid default null, p_priority text default 'normal', p_notes text default null,
  p_location text default 'interno', p_external_lab text default null)
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
  insert into public.lab_orders(clinic_id, number, patient_id, doctor_id, consultation_id, priority, clinical_notes, created_by, location, external_lab)
  values (p_clinic, 'L-' || lpad(v_seq::text, 6, '0'), p_patient, p_doctor, p_consultation,
          case when p_priority = 'urgente' then 'urgente' else 'normal' end, nullif(trim(p_notes), ''), auth.uid(),
          case when p_location = 'externo' then 'externo' else 'interno' end, nullif(trim(coalesce(p_external_lab, '')), ''))
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
revoke execute on function public.create_lab_order(uuid, uuid, uuid, jsonb, uuid, text, text, text, text) from public, anon;
grant execute on function public.create_lab_order(uuid, uuid, uuid, jsonb, uuid, text, text, text, text) to authenticated;

create or replace function public.save_lab_result(
  p_item uuid, p_result text, p_complete boolean default true,
  p_file_path text default null, p_file_name text default null)
returns void language plpgsql security definer set search_path = public as $fn$
declare
  v_item public.lab_order_items; v_order public.lab_orders; v_pending int;
begin
  select * into v_item from public.lab_order_items where id = p_item;
  if v_item.id is null then raise exception 'Estudio inválido'; end if;
  select * into v_order from public.lab_orders where id = v_item.order_id;
  perform public.require_lab_result_perm(v_order);
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
  perform public.require_lab_result_perm(v_order);
  if v_order.status = 'completado' then raise exception 'Un pedido completado no puede anularse'; end if;
  if coalesce(trim(p_reason), '') = '' then raise exception 'Indicá el motivo de la anulación'; end if;
  update public.lab_orders set status = 'anulado', void_reason = trim(p_reason) where id = p_order;
end $fn$;

-- Archivos: también puede subirlos quien edita historias (los médicos), para pedidos externos.
drop policy if exists lab_docs_insert on storage.objects;
create policy lab_docs_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'documentos' and (storage.foldername(name))[2] = 'laboratorio'
              and (public.has_perm(((storage.foldername(name))[1])::uuid, 'laboratorio', 'edit')
                   or public.has_perm(((storage.foldername(name))[1])::uuid, 'historias', 'edit')));
