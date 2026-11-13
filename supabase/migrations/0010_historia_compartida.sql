-- Medvia · Historia clínica compartida entre médicos
-- El médico ve el historial completo (consultas, recetas y estudios de cualquier colega) de SUS pacientes.
-- Sigue sin ver pacientes que no le corresponden, y solo puede crear o modificar lo propio.

drop policy if exists consultations_sel on public.consultations;
create policy consultations_sel on public.consultations for select to authenticated
  using (public.has_perm(clinic_id, 'historias', 'view')
         and (public.sees_doctor(clinic_id, doctor_id) or public.sees_patient(clinic_id, patient_id)));

drop policy if exists amend_sel on public.consultation_amendments;
create policy amend_sel on public.consultation_amendments for select to authenticated
  using (public.has_perm(clinic_id, 'historias', 'view') and exists (
    select 1 from public.consultations c where c.id = consultation_id
      and (public.sees_doctor(c.clinic_id, c.doctor_id) or public.sees_patient(c.clinic_id, c.patient_id))));

drop policy if exists prescriptions_sel on public.prescriptions;
create policy prescriptions_sel on public.prescriptions for select to authenticated
  using ((public.has_perm(clinic_id, 'recetas', 'view')
          and (public.sees_doctor(clinic_id, doctor_id) or public.sees_patient(clinic_id, patient_id)))
         or public.has_perm(clinic_id, 'farmacia', 'view'));

drop policy if exists prescription_items_sel on public.prescription_items;
create policy prescription_items_sel on public.prescription_items for select to authenticated
  using (exists (select 1 from public.prescriptions r where r.id = prescription_id
    and ((public.has_perm(r.clinic_id, 'recetas', 'view')
          and (public.sees_doctor(r.clinic_id, r.doctor_id) or public.sees_patient(r.clinic_id, r.patient_id)))
         or public.has_perm(r.clinic_id, 'farmacia', 'view'))));

drop policy if exists lab_orders_sel on public.lab_orders;
create policy lab_orders_sel on public.lab_orders for select to authenticated
  using (public.has_perm(clinic_id, 'laboratorio', 'view')
         and (public.sees_doctor(clinic_id, doctor_id) or public.sees_patient(clinic_id, patient_id)));

drop policy if exists lab_order_items_sel on public.lab_order_items;
create policy lab_order_items_sel on public.lab_order_items for select to authenticated
  using (exists (select 1 from public.lab_orders o where o.id = order_id
    and public.has_perm(o.clinic_id, 'laboratorio', 'view')
    and (public.sees_doctor(o.clinic_id, o.doctor_id) or public.sees_patient(o.clinic_id, o.patient_id))));

drop policy if exists lab_docs_read on storage.objects;
create policy lab_docs_read on storage.objects for select to authenticated
  using (bucket_id = 'documentos' and (storage.foldername(name))[2] = 'laboratorio'
         and exists (select 1 from public.lab_orders o where o.id::text = (storage.foldername(name))[3]
                     and public.has_perm(o.clinic_id, 'laboratorio', 'view')
                     and (public.sees_doctor(o.clinic_id, o.doctor_id) or public.sees_patient(o.clinic_id, o.patient_id))));

drop policy if exists disp_sel on public.dispensations;
create policy disp_sel on public.dispensations for select to authenticated
  using (public.has_perm(clinic_id, 'farmacia', 'view') or exists (
    select 1 from public.prescriptions r where r.id = prescription_id and public.has_perm(r.clinic_id, 'recetas', 'view')
      and (public.sees_doctor(r.clinic_id, r.doctor_id) or public.sees_patient(r.clinic_id, r.patient_id))));
