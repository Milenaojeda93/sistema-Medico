-- Medvia · Cada médico ve solo sus pacientes, consultas, agenda, recetas y estudios
-- Aplica al rol "medico" cuando la clínica tiene activada la opción (por defecto: sí).
-- El resto de los roles (admin, recepción, enfermería, laboratorio, farmacia, caja) no cambia.

alter table public.clinics add column if not exists doctors_see_own_only boolean not null default true;

create or replace function public.own_only(p_clinic uuid)
returns boolean language sql stable security definer set search_path = public as $fn$
  select exists (
    select 1 from public.clinic_members m join public.clinics c on c.id = m.clinic_id
    where m.clinic_id = p_clinic and m.user_id = auth.uid() and m.active and m.role = 'medico' and c.doctors_see_own_only);
$fn$;

create or replace function public.my_doctor_ids(p_clinic uuid)
returns uuid[] language sql stable security definer set search_path = public as $fn$
  select coalesce(array_agg(id), '{}') from public.doctors where clinic_id = p_clinic and user_id = auth.uid();
$fn$;

create or replace function public.sees_doctor(p_clinic uuid, p_doctor uuid)
returns boolean language sql stable security definer set search_path = public as $fn$
  select not public.own_only(p_clinic) or p_doctor = any(public.my_doctor_ids(p_clinic));
$fn$;

create or replace function public.sees_patient(p_clinic uuid, p_patient uuid)
returns boolean language sql stable security definer set search_path = public as $fn$
  select not public.own_only(p_clinic)
    or exists (select 1 from public.patients p where p.id = p_patient and p.created_by = auth.uid())
    or exists (select 1 from public.appointments a where a.patient_id = p_patient and a.doctor_id = any(public.my_doctor_ids(p_clinic)))
    or exists (select 1 from public.consultations c where c.patient_id = p_patient and c.doctor_id = any(public.my_doctor_ids(p_clinic)));
$fn$;

revoke execute on function public.own_only(uuid) from public, anon;
revoke execute on function public.my_doctor_ids(uuid) from public, anon;
revoke execute on function public.sees_doctor(uuid, uuid) from public, anon;
revoke execute on function public.sees_patient(uuid, uuid) from public, anon;
grant execute on function public.own_only(uuid) to authenticated;
grant execute on function public.my_doctor_ids(uuid) to authenticated;
grant execute on function public.sees_doctor(uuid, uuid) to authenticated;
grant execute on function public.sees_patient(uuid, uuid) to authenticated;

-- ===== Pacientes y datos del paciente =====
drop policy if exists patients_sel on public.patients;
drop policy if exists patients_upd on public.patients;
drop policy if exists patients_del on public.patients;
create policy patients_sel on public.patients for select to authenticated
  using (public.has_perm(clinic_id, 'pacientes', 'view') and (created_by = auth.uid() or public.sees_patient(clinic_id, id)));
create policy patients_upd on public.patients for update to authenticated
  using (public.has_perm(clinic_id, 'pacientes', 'edit') and (created_by = auth.uid() or public.sees_patient(clinic_id, id)))
  with check (public.has_perm(clinic_id, 'pacientes', 'edit'));
create policy patients_del on public.patients for delete to authenticated
  using (public.has_perm(clinic_id, 'pacientes', 'delete') and public.sees_patient(clinic_id, id));

do $fn$
declare rec record;
begin
  for rec in select * from (values
    ('patient_insurances','seguros'), ('authorizations','autorizaciones'), ('patient_documents','pacientes'), ('invoices','facturacion')
  ) as x(tbl, module) loop
    execute format('drop policy if exists %1$s_sel on public.%1$I', rec.tbl);
    execute format('drop policy if exists %1$s_ins on public.%1$I', rec.tbl);
    execute format('drop policy if exists %1$s_upd on public.%1$I', rec.tbl);
    execute format('drop policy if exists %1$s_del on public.%1$I', rec.tbl);
    execute format('create policy %1$s_sel on public.%1$I for select to authenticated using (public.has_perm(clinic_id, %2$L, ''view'') and public.sees_patient(clinic_id, patient_id))', rec.tbl, rec.module);
    execute format('create policy %1$s_ins on public.%1$I for insert to authenticated with check (public.has_perm(clinic_id, %2$L, ''create'') and public.sees_patient(clinic_id, patient_id))', rec.tbl, rec.module);
    execute format('create policy %1$s_upd on public.%1$I for update to authenticated using (public.has_perm(clinic_id, %2$L, ''edit'') and public.sees_patient(clinic_id, patient_id)) with check (public.has_perm(clinic_id, %2$L, ''edit''))', rec.tbl, rec.module);
    execute format('create policy %1$s_del on public.%1$I for delete to authenticated using (public.has_perm(clinic_id, %2$L, ''delete'') and public.sees_patient(clinic_id, patient_id))', rec.tbl, rec.module);
  end loop;
end $fn$;

-- ===== Agenda y consultas: solo las del propio médico =====
do $fn$
declare rec record;
begin
  for rec in select * from (values ('appointments','agenda'), ('consultations','historias')) as x(tbl, module) loop
    execute format('drop policy if exists %1$s_sel on public.%1$I', rec.tbl);
    execute format('drop policy if exists %1$s_ins on public.%1$I', rec.tbl);
    execute format('drop policy if exists %1$s_upd on public.%1$I', rec.tbl);
    execute format('drop policy if exists %1$s_del on public.%1$I', rec.tbl);
    execute format('create policy %1$s_sel on public.%1$I for select to authenticated using (public.has_perm(clinic_id, %2$L, ''view'') and public.sees_doctor(clinic_id, doctor_id))', rec.tbl, rec.module);
    execute format('create policy %1$s_ins on public.%1$I for insert to authenticated with check (public.has_perm(clinic_id, %2$L, ''create'') and public.sees_doctor(clinic_id, doctor_id))', rec.tbl, rec.module);
    execute format('create policy %1$s_upd on public.%1$I for update to authenticated using (public.has_perm(clinic_id, %2$L, ''edit'') and public.sees_doctor(clinic_id, doctor_id)) with check (public.has_perm(clinic_id, %2$L, ''edit'') and public.sees_doctor(clinic_id, doctor_id))', rec.tbl, rec.module);
    execute format('create policy %1$s_del on public.%1$I for delete to authenticated using (public.has_perm(clinic_id, %2$L, ''delete'') and public.sees_doctor(clinic_id, doctor_id))', rec.tbl, rec.module);
  end loop;
end $fn$;

drop policy if exists amend_sel on public.consultation_amendments;
create policy amend_sel on public.consultation_amendments for select to authenticated
  using (public.has_perm(clinic_id, 'historias', 'view') and exists (
    select 1 from public.consultations c where c.id = consultation_id and public.sees_doctor(c.clinic_id, c.doctor_id)));

-- ===== Recetas y estudios =====
drop policy if exists prescriptions_sel on public.prescriptions;
drop policy if exists prescriptions_upd on public.prescriptions;
drop policy if exists prescription_items_sel on public.prescription_items;
create policy prescriptions_sel on public.prescriptions for select to authenticated
  using ((public.has_perm(clinic_id, 'recetas', 'view') and public.sees_doctor(clinic_id, doctor_id)) or public.has_perm(clinic_id, 'farmacia', 'view'));
create policy prescriptions_upd on public.prescriptions for update to authenticated
  using (public.has_perm(clinic_id, 'recetas', 'edit') and public.sees_doctor(clinic_id, doctor_id))
  with check (public.has_perm(clinic_id, 'recetas', 'edit'));
create policy prescription_items_sel on public.prescription_items for select to authenticated
  using (exists (select 1 from public.prescriptions r where r.id = prescription_id
    and ((public.has_perm(r.clinic_id, 'recetas', 'view') and public.sees_doctor(r.clinic_id, r.doctor_id)) or public.has_perm(r.clinic_id, 'farmacia', 'view'))));

drop policy if exists lab_orders_sel on public.lab_orders;
drop policy if exists lab_order_items_sel on public.lab_order_items;
create policy lab_orders_sel on public.lab_orders for select to authenticated
  using (public.has_perm(clinic_id, 'laboratorio', 'view') and public.sees_doctor(clinic_id, doctor_id));
create policy lab_order_items_sel on public.lab_order_items for select to authenticated
  using (exists (select 1 from public.lab_orders o where o.id = order_id
    and public.has_perm(o.clinic_id, 'laboratorio', 'view') and public.sees_doctor(o.clinic_id, o.doctor_id)));

drop policy if exists disp_sel on public.dispensations;
create policy disp_sel on public.dispensations for select to authenticated
  using (public.has_perm(clinic_id, 'farmacia', 'view') or exists (
    select 1 from public.prescriptions r where r.id = prescription_id
      and public.has_perm(r.clinic_id, 'recetas', 'view') and public.sees_doctor(r.clinic_id, r.doctor_id)));

-- Las funciones que emiten recetas/estudios o modifican consultas también respetan la regla
create or replace function public.enforce_own_doctor()
returns trigger language plpgsql set search_path = public as $fn$
declare v_doctor uuid := case when tg_op = 'DELETE' then old.doctor_id else new.doctor_id end;
        v_clinic uuid := case when tg_op = 'DELETE' then old.clinic_id else new.clinic_id end;
begin
  if not public.sees_doctor(v_clinic, v_doctor)
     or (tg_op = 'UPDATE' and not public.sees_doctor(old.clinic_id, old.doctor_id)) then
    raise exception 'Solo podés gestionar tus propios pacientes y consultas' using errcode = '42501';
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end $fn$;
create trigger own_doctor_prescriptions before insert on public.prescriptions for each row execute function public.enforce_own_doctor();
create trigger own_doctor_lab before insert on public.lab_orders for each row execute function public.enforce_own_doctor();
create trigger own_doctor_consultations before insert or update on public.consultations for each row execute function public.enforce_own_doctor();
revoke execute on function public.enforce_own_doctor() from authenticated, public, anon;

-- ===== Archivos =====
drop policy if exists docs_read on storage.objects;
create policy docs_read on storage.objects for select to authenticated
  using (bucket_id = 'documentos' and public.has_perm(((storage.foldername(name))[1])::uuid, 'pacientes', 'view')
         and case when (storage.foldername(name))[2] = 'pacientes'
                  then public.sees_patient(((storage.foldername(name))[1])::uuid, ((storage.foldername(name))[3])::uuid)
                  else true end);
drop policy if exists lab_docs_read on storage.objects;
create policy lab_docs_read on storage.objects for select to authenticated
  using (bucket_id = 'documentos' and (storage.foldername(name))[2] = 'laboratorio'
         and exists (select 1 from public.lab_orders o where o.id::text = (storage.foldername(name))[3]
                     and public.has_perm(o.clinic_id, 'laboratorio', 'view') and public.sees_doctor(o.clinic_id, o.doctor_id)));

-- ===== Dashboard: el médico ve solo sus números =====
create or replace function public.dashboard_stats(p_clinic uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $fn$
declare
  v_tz text; v_today date; v_month date; r jsonb;
  v_own boolean := public.own_only(p_clinic);
  v_docs uuid[] := public.my_doctor_ids(p_clinic);
  v_money boolean;
begin
  perform public.require_perm(p_clinic, 'dashboard', 'view');
  v_money := not v_own;
  select timezone into v_tz from public.clinics where id = p_clinic;
  v_today := (now() at time zone v_tz)::date;
  v_month := date_trunc('month', v_today)::date;

  select jsonb_build_object(
    'own_only', v_own,
    'total_patients', (select count(*) from patients p where p.clinic_id = p_clinic and not p.archived and (not v_own or public.sees_patient(p_clinic, p.id))),
    'new_patients_month', (select count(*) from patients p where p.clinic_id = p_clinic and (p.created_at at time zone v_tz)::date >= v_month and (not v_own or public.sees_patient(p_clinic, p.id))),
    'consultations_today', (select count(*) from consultations where clinic_id = p_clinic and (consulted_at at time zone v_tz)::date = v_today and (not v_own or doctor_id = any(v_docs))),
    'appointments_today', (select count(*) from appointments where clinic_id = p_clinic and (starts_at at time zone v_tz)::date = v_today and status not in ('cancelada') and (not v_own or doctor_id = any(v_docs))),
    'pending_appointments', (select count(*) from appointments where clinic_id = p_clinic and (starts_at at time zone v_tz)::date >= v_today and status = 'pendiente' and (not v_own or doctor_id = any(v_docs))),
    'confirmed_appointments', (select count(*) from appointments where clinic_id = p_clinic and (starts_at at time zone v_tz)::date >= v_today and status = 'confirmada' and (not v_own or doctor_id = any(v_docs))),
    'available_doctors', (select count(distinct d.id) from doctors d join doctor_schedules s on s.doctor_id = d.id
                          where d.clinic_id = p_clinic and d.active and s.weekday = extract(dow from v_today) and (not v_own or d.id = any(v_docs))),
    'active_doctors', (select count(*) from doctors where clinic_id = p_clinic and active and (not v_own or id = any(v_docs))),
    'consultations_month', (select count(*) from consultations where clinic_id = p_clinic and (consulted_at at time zone v_tz)::date >= v_month and (not v_own or doctor_id = any(v_docs))),
    'income_today', case when v_money then (select coalesce(sum(amount),0) from payments where clinic_id = p_clinic and (paid_at at time zone v_tz)::date = v_today)
                    + (select coalesce(sum(ip.amount),0) from insurer_payments ip where ip.clinic_id = p_clinic and ip.paid_at = v_today) else 0 end,
    'income_month', case when v_money then (select coalesce(sum(amount),0) from payments where clinic_id = p_clinic and (paid_at at time zone v_tz)::date >= v_month)
                    + (select coalesce(sum(ip.amount),0) from insurer_payments ip where ip.clinic_id = p_clinic and ip.paid_at >= v_month) else 0 end,
    'pending_invoices', case when v_money then (select count(*) from invoices where clinic_id = p_clinic and status in ('pendiente','parcial')) else 0 end,
    'pending_invoices_amount', case when v_money then (select coalesce(sum(patient_amount - patient_paid),0) from invoices where clinic_id = p_clinic and status in ('pendiente','parcial')) else 0 end,
    'insurer_receivable', case when v_money then (select coalesce(sum(i.insurer_amount),0) from invoices i where i.clinic_id = p_clinic and i.status <> 'anulada')
        - (select coalesce(sum(total_rejected + total_paid),0) from insurer_settlements where clinic_id = p_clinic) else 0 end,
    'consultations_by_day', (select coalesce(jsonb_agg(jsonb_build_object('date', d::date, 'total', coalesce(c.n,0)) order by d), '[]')
        from generate_series(v_today - 29, v_today, '1 day') d
        left join (select (consulted_at at time zone v_tz)::date dd, count(*) n from consultations
                   where clinic_id = p_clinic and (not v_own or doctor_id = any(v_docs)) group by 1) c on c.dd = d::date),
    'consultations_by_specialty', (select coalesce(jsonb_agg(jsonb_build_object('name', x.name, 'total', x.n) order by x.n desc), '[]') from (
        select coalesce(s.name,'Sin especialidad') name, count(*) n from consultations c left join specialties s on s.id = c.specialty_id
        where c.clinic_id = p_clinic and c.consulted_at >= now() - interval '90 days' and (not v_own or c.doctor_id = any(v_docs)) group by 1) x),
    'income_by_month', (select coalesce(jsonb_agg(jsonb_build_object('month', to_char(m,'YYYY-MM'),
          'particular', case when v_money then (select coalesce(sum(p.amount),0) from payments p where p.clinic_id = p_clinic and date_trunc('month', p.paid_at at time zone v_tz) = m) else 0 end,
          'aseguradoras', case when v_money then (select coalesce(sum(ip.amount),0) from insurer_payments ip where ip.clinic_id = p_clinic and date_trunc('month', ip.paid_at) = m) else 0 end
        ) order by m), '[]')
        from generate_series(date_trunc('month', v_today) - interval '5 months', date_trunc('month', v_today), '1 month') m),
    'new_patients_by_month', (select coalesce(jsonb_agg(jsonb_build_object('month', to_char(m,'YYYY-MM'),
          'total', (select count(*) from patients p where p.clinic_id = p_clinic and date_trunc('month', p.created_at at time zone v_tz) = m
                    and (not v_own or public.sees_patient(p_clinic, p.id)))) order by m), '[]')
        from generate_series(date_trunc('month', v_today) - interval '5 months', date_trunc('month', v_today), '1 month') m),
    'care_type_distribution', (select coalesce(jsonb_agg(jsonb_build_object('name', care_type, 'total', n)), '[]') from (
        select care_type, count(*) n from appointments where clinic_id = p_clinic and starts_at >= now() - interval '90 days'
        and status <> 'cancelada' and (not v_own or doctor_id = any(v_docs)) group by 1) x),
    'upcoming', (select coalesce(jsonb_agg(x order by x.starts_at), '[]') from (
        select a.id, a.starts_at, a.status, a.care_type, p.first_name || ' ' || p.last_name patient, d.full_name doctor, s.name specialty
        from appointments a join patients p on p.id = a.patient_id join doctors d on d.id = a.doctor_id
        left join specialties s on s.id = a.specialty_id
        where a.clinic_id = p_clinic and a.starts_at >= now() - interval '30 minutes' and a.status in ('pendiente','confirmada','en_espera')
          and (not v_own or a.doctor_id = any(v_docs))
        order by a.starts_at limit 8) x),
    'activity', (select coalesce(jsonb_agg(x order by x.created_at desc), '[]') from (
        select l.table_name, l.action, l.created_at, coalesce(pr.full_name, 'Sistema') user_name
        from audit_log l left join profiles pr on pr.id = l.user_id
        where l.clinic_id = p_clinic and l.table_name in ('patients','appointments','consultations','invoices','payments','authorizations','patient_insurances')
          and (not v_own or l.user_id = auth.uid())
        order by l.created_at desc limit 10) x)
  ) into r;
  return r;
end $fn$;
