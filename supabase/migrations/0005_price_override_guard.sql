-- Medvia · Solo quien administra tarifas puede cambiar el precio de lista al facturar
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
    if v_price <> v_svc.price and not public.has_perm(p_clinic, 'configuracion', 'edit') then
      raise exception 'No tenés permiso para modificar el precio de lista de "%"', v_svc.name;
    end if;
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

