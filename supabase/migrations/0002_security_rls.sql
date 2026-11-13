-- Medvia · Seguridad: helpers, permisos por rol, RLS, auditoría, integridad
alter table public.clinics add column if not exists timezone text not null default 'America/Asuncion';

create table public.patient_documents (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  patient_id uuid not null references public.patients(id) on delete cascade,
  patient_insurance_id uuid references public.patient_insurances(id) on delete cascade,
  authorization_id uuid references public.authorizations(id) on delete cascade,
  name text not null,
  category text not null default 'general',
  storage_path text not null,
  mime_type text,
  size_bytes bigint,
  uploaded_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);
create index on public.patient_documents(patient_id);

-- ============ HELPERS ============
create or replace function public.is_platform_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.platform_admins where user_id = auth.uid());
$$;

create or replace function public.is_member(p_clinic uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.clinic_members m
    join public.clinics c on c.id = m.clinic_id
    where m.clinic_id = p_clinic and m.user_id = auth.uid() and m.active
      and c.status in ('prueba','activa')
  );
$$;

create or replace function public.has_perm(p_clinic uuid, p_module text, p_action text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1
    from public.clinic_members m
    join public.clinics c on c.id = m.clinic_id and c.status in ('prueba','activa')
    join public.role_permissions rp on rp.clinic_id = m.clinic_id and rp.role = m.role and rp.module = p_module
    where m.clinic_id = p_clinic and m.user_id = auth.uid() and m.active
      and case p_action
            when 'view' then rp.can_view
            when 'create' then rp.can_create
            when 'edit' then rp.can_edit
            when 'delete' then rp.can_delete
            else false end
  );
$$;

create or replace function public.require_perm(p_clinic uuid, p_module text, p_action text)
returns void language plpgsql stable security definer set search_path = public as $$
begin
  if not public.has_perm(p_clinic, p_module, p_action) then
    raise exception 'No tenés permiso para % en el módulo %', p_action, p_module using errcode = '42501';
  end if;
end $$;

-- ============ MATRIZ DE PERMISOS POR DEFECTO ============
create or replace function public.seed_role_permissions(p_clinic uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  modules text[] := array['dashboard','pacientes','agenda','consultas','historias','medicos','especialidades',
    'seguros','aseguradoras','autorizaciones','recetas','laboratorio','farmacia','inventario',
    'facturacion','caja','reportes','usuarios','configuracion','auditoria'];
  m text;
  -- formato: rol => módulo:acciones (v=ver c=crear e=editar d=eliminar)
  defaults jsonb := '{
    "recepcionista": {"dashboard":"v","pacientes":"vce","agenda":"vced","consultas":"v","medicos":"v","especialidades":"v","seguros":"vce","aseguradoras":"v","autorizaciones":"vce","facturacion":"vc","caja":"vc","reportes":"v"},
    "medico": {"dashboard":"v","pacientes":"vce","agenda":"vce","consultas":"vce","historias":"vce","medicos":"v","especialidades":"v","seguros":"v","aseguradoras":"v","autorizaciones":"vc","recetas":"vce","laboratorio":"vc","reportes":"v"},
    "enfermeria": {"dashboard":"v","pacientes":"ve","agenda":"ve","consultas":"v","historias":"vce","medicos":"v","especialidades":"v","seguros":"v"},
    "laboratorio": {"dashboard":"v","pacientes":"v","historias":"v","laboratorio":"vce","medicos":"v"},
    "farmacia": {"dashboard":"v","pacientes":"v","recetas":"v","farmacia":"vce","inventario":"vce"},
    "caja": {"dashboard":"v","pacientes":"v","seguros":"v","aseguradoras":"v","autorizaciones":"v","facturacion":"vce","caja":"vce","reportes":"v"}
  }';
  r public.clinic_role;
  acts text;
begin
  foreach r in array enum_range(null::public.clinic_role) loop
    foreach m in array modules loop
      if r in ('admin_clinica','administrador') then
        acts := 'vced';
      else
        acts := coalesce(defaults -> r::text ->> m, '');
      end if;
      insert into public.role_permissions(clinic_id, role, module, can_view, can_create, can_edit, can_delete)
      values (p_clinic, r, m, acts like '%v%', acts like '%c%', acts like '%e%', acts like '%d%')
      on conflict (clinic_id, role, module) do nothing;
    end loop;
  end loop;
end $$;

-- ============ PERFILES ============
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles(id, full_name, email)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email,'@',1)), new.email)
  on conflict (id) do nothing;
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============ TIMESTAMPS ============
create or replace function public.set_updated_at()
returns trigger language plpgsql set search_path = public as $$
begin new.updated_at := now(); return new; end $$;
create trigger patients_updated before update on public.patients for each row execute function public.set_updated_at();
create trigger consultations_updated before update on public.consultations for each row execute function public.set_updated_at();

-- ============ INTEGRIDAD ENTRE TENANTS ============
-- Impide referenciar registros de otra clínica aunque el usuario pertenezca a ambas.
create or replace function public.enforce_same_clinic()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  col text; tbl text; ref_id uuid; ref_clinic uuid; i int;
begin
  for i in 0 .. (array_length(TG_ARGV,1)/2 - 1) loop
    col := TG_ARGV[i*2]; tbl := TG_ARGV[i*2+1];
    execute format('select ($1).%I', col) into ref_id using new;
    if ref_id is not null then
      execute format('select clinic_id from public.%I where id = $1', tbl) into ref_clinic using ref_id;
      if ref_clinic is distinct from new.clinic_id then
        raise exception 'Referencia inválida: % no pertenece a esta institución', col;
      end if;
    end if;
  end loop;
  return new;
end $$;

create trigger chk_doctors before insert or update on public.doctors for each row
  execute function public.enforce_same_clinic('room_id','rooms');
create trigger chk_doctor_specialties before insert or update on public.doctor_specialties for each row
  execute function public.enforce_same_clinic('doctor_id','doctors','specialty_id','specialties');
create trigger chk_doctor_schedules before insert or update on public.doctor_schedules for each row
  execute function public.enforce_same_clinic('doctor_id','doctors','room_id','rooms');
create trigger chk_services before insert or update on public.services for each row
  execute function public.enforce_same_clinic('specialty_id','specialties');
create trigger chk_plans before insert or update on public.insurance_plans for each row
  execute function public.enforce_same_clinic('insurer_id','insurers');
create trigger chk_coverages before insert or update on public.plan_coverages for each row
  execute function public.enforce_same_clinic('plan_id','insurance_plans','specialty_id','specialties');
create trigger chk_pi before insert or update on public.patient_insurances for each row
  execute function public.enforce_same_clinic('patient_id','patients','insurer_id','insurers','plan_id','insurance_plans');
create trigger chk_auth before insert or update on public.authorizations for each row
  execute function public.enforce_same_clinic('patient_id','patients','patient_insurance_id','patient_insurances','service_id','services','doctor_id','doctors');
create trigger chk_appt before insert or update on public.appointments for each row
  execute function public.enforce_same_clinic('patient_id','patients','doctor_id','doctors','specialty_id','specialties','room_id','rooms','patient_insurance_id','patient_insurances');
create trigger chk_cons before insert or update on public.consultations for each row
  execute function public.enforce_same_clinic('patient_id','patients','doctor_id','doctors','specialty_id','specialties','appointment_id','appointments');
create trigger chk_docs before insert or update on public.patient_documents for each row
  execute function public.enforce_same_clinic('patient_id','patients','patient_insurance_id','patient_insurances','authorization_id','authorizations');

-- El plan del seguro del paciente debe pertenecer a la aseguradora indicada
create or replace function public.check_pi_plan()
returns trigger language plpgsql set search_path = public as $$
begin
  if not exists (select 1 from public.insurance_plans where id = new.plan_id and insurer_id = new.insurer_id) then
    raise exception 'El plan seleccionado no pertenece a la aseguradora';
  end if;
  if new.end_date is not null and new.end_date < new.start_date then
    raise exception 'La fecha de vencimiento no puede ser anterior al inicio de cobertura';
  end if;
  return new;
end $$;
create trigger pi_plan_check before insert or update on public.patient_insurances
  for each row execute function public.check_pi_plan();

-- La cita por seguro debe usar un seguro del mismo paciente
create or replace function public.check_appt_insurance()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.care_type = 'particular' then new.patient_insurance_id := null; end if;
  if new.patient_insurance_id is not null and not exists (
    select 1 from public.patient_insurances where id = new.patient_insurance_id and patient_id = new.patient_id) then
    raise exception 'El seguro seleccionado no pertenece al paciente';
  end if;
  return new;
end $$;
create trigger appt_insurance_check before insert or update on public.appointments
  for each row execute function public.check_appt_insurance();

-- ============ HISTORIA CLÍNICA INMUTABLE ============
create or replace function public.protect_closed_consultation()
returns trigger language plpgsql set search_path = public as $$
begin
  if tg_op = 'DELETE' then
    if old.status = 'cerrada' then
      raise exception 'Una historia clínica cerrada no puede eliminarse';
    end if;
    return old;
  end if;
  if old.status = 'cerrada' and coalesce(current_setting('app.amending', true), '') <> 'on' then
    raise exception 'La consulta está cerrada. Las correcciones deben registrarse como enmienda.';
  end if;
  if old.status = 'cerrada' and new.status <> 'cerrada' then
    raise exception 'Una consulta cerrada no puede reabrirse';
  end if;
  return new;
end $$;
create trigger consultations_protect before update or delete on public.consultations
  for each row execute function public.protect_closed_consultation();

create or replace function public.protect_amendments()
returns trigger language plpgsql set search_path = public as $$
begin raise exception 'Las enmiendas son inmutables'; end $$;
create trigger amendments_immutable before update or delete on public.consultation_amendments
  for each row execute function public.protect_amendments();

-- ============ AUDITORÍA ============
create or replace function public.audit_trigger()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_old jsonb; v_new jsonb; v_clinic uuid; v_id uuid;
begin
  if tg_op in ('UPDATE','DELETE') then v_old := to_jsonb(old); end if;
  if tg_op in ('INSERT','UPDATE') then v_new := to_jsonb(new); end if;
  v_clinic := coalesce((v_new->>'clinic_id')::uuid, (v_old->>'clinic_id')::uuid);
  if tg_table_name = 'clinics' then v_clinic := coalesce((v_new->>'id')::uuid, (v_old->>'id')::uuid); end if;
  begin
    v_id := coalesce((v_new->>'id')::uuid, (v_old->>'id')::uuid);
  exception when others then v_id := null; end;
  if tg_op = 'UPDATE' and (v_old - 'updated_at') = (v_new - 'updated_at') then return new; end if;
  if tg_op = 'DELETE' and tg_table_name <> 'clinics' and not exists (select 1 from public.clinics where id = v_clinic) then
    return old;
  end if;
  insert into public.audit_log(clinic_id, user_id, table_name, record_id, action, old_data, new_data)
  values (case when tg_op = 'DELETE' and tg_table_name = 'clinics' then null else v_clinic end,
          auth.uid(), tg_table_name, v_id, lower(tg_op), v_old, v_new);
  return coalesce(new, old);
end $$;

do $$
declare t text;
begin
  foreach t in array array['clinics','clinic_members','role_permissions','specialties','rooms','doctors',
    'doctor_schedules','services','patients','insurers','insurance_plans','plan_coverages','patient_insurances',
    'authorizations','appointments','consultations','consultation_amendments','invoices','payments',
    'insurer_settlements','settlement_items','insurer_payments','patient_documents'] loop
    execute format('create trigger audit_%1$s after insert or update or delete on public.%1$I
      for each row execute function public.audit_trigger()', t);
  end loop;
end $$;

-- ============ RLS ============
do $$
declare t text;
begin
  foreach t in array array['subscription_plans','clinics','platform_admins','profiles','clinic_members','role_permissions',
    'specialties','rooms','doctors','doctor_specialties','doctor_schedules','services','patients','insurers',
    'insurance_plans','plan_coverages','patient_insurances','authorizations','appointments','consultations',
    'consultation_amendments','invoices','invoice_items','payments','insurer_settlements','settlement_items',
    'insurer_payments','audit_log','patient_documents'] loop
    execute format('alter table public.%I enable row level security', t);
  end loop;
end $$;

-- Plataforma
create policy sp_read on public.subscription_plans for select to authenticated using (true);
create policy sp_admin on public.subscription_plans for all to authenticated
  using (public.is_platform_admin()) with check (public.is_platform_admin());

create policy pa_self on public.platform_admins for select to authenticated
  using (user_id = auth.uid() or public.is_platform_admin());

create policy clinics_read on public.clinics for select to authenticated
  using (public.is_platform_admin() or exists (
    select 1 from public.clinic_members m where m.clinic_id = clinics.id and m.user_id = auth.uid() and m.active));
create policy clinics_update on public.clinics for update to authenticated
  using (public.is_platform_admin() or public.has_perm(id, 'configuracion', 'edit'))
  with check (public.is_platform_admin() or public.has_perm(id, 'configuracion', 'edit'));

create policy profiles_read on public.profiles for select to authenticated
  using (id = auth.uid() or public.is_platform_admin() or exists (
    select 1 from public.clinic_members a join public.clinic_members b on a.clinic_id = b.clinic_id
    where a.user_id = auth.uid() and b.user_id = profiles.id and public.is_member(a.clinic_id)));
create policy profiles_update on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

create policy members_read on public.clinic_members for select to authenticated
  using (user_id = auth.uid() or public.has_perm(clinic_id, 'usuarios', 'view') or public.is_platform_admin());
create policy members_update on public.clinic_members for update to authenticated
  using (public.has_perm(clinic_id, 'usuarios', 'edit') and user_id <> auth.uid())
  with check (public.has_perm(clinic_id, 'usuarios', 'edit'));
create policy members_delete on public.clinic_members for delete to authenticated
  using (public.has_perm(clinic_id, 'usuarios', 'delete') and user_id <> auth.uid());

create policy perms_read on public.role_permissions for select to authenticated
  using (public.is_member(clinic_id));
create policy perms_update on public.role_permissions for update to authenticated
  using (public.has_perm(clinic_id, 'usuarios', 'edit') and role <> 'admin_clinica')
  with check (public.has_perm(clinic_id, 'usuarios', 'edit') and role <> 'admin_clinica');

-- Catálogos: lectura para cualquier miembro, escritura según módulo
do $$
declare
  rec record;
begin
  for rec in select * from (values
    ('specialties','especialidades'), ('rooms','configuracion'), ('doctors','medicos'),
    ('doctor_specialties','medicos'), ('doctor_schedules','medicos'), ('services','configuracion'),
    ('insurers','aseguradoras'), ('insurance_plans','aseguradoras'), ('plan_coverages','aseguradoras')
  ) as x(tbl, module) loop
    execute format('create policy %1$s_sel on public.%1$I for select to authenticated using (public.is_member(clinic_id))', rec.tbl);
    execute format('create policy %1$s_ins on public.%1$I for insert to authenticated with check (public.has_perm(clinic_id, %2$L, ''create''))', rec.tbl, rec.module);
    execute format('create policy %1$s_upd on public.%1$I for update to authenticated using (public.has_perm(clinic_id, %2$L, ''edit'')) with check (public.has_perm(clinic_id, %2$L, ''edit''))', rec.tbl, rec.module);
    execute format('create policy %1$s_del on public.%1$I for delete to authenticated using (public.has_perm(clinic_id, %2$L, ''delete''))', rec.tbl, rec.module);
  end loop;
end $$;

-- Datos operativos/sensibles: todas las acciones según módulo
do $$
declare
  rec record;
begin
  for rec in select * from (values
    ('patients','pacientes'), ('patient_insurances','seguros'), ('authorizations','autorizaciones'),
    ('appointments','agenda'), ('consultations','historias'), ('patient_documents','pacientes'),
    ('invoices','facturacion'), ('invoice_items','facturacion'), ('payments','caja'),
    ('insurer_settlements','facturacion'), ('settlement_items','facturacion'), ('insurer_payments','facturacion')
  ) as x(tbl, module) loop
    execute format('create policy %1$s_sel on public.%1$I for select to authenticated using (public.has_perm(clinic_id, %2$L, ''view''))', rec.tbl, rec.module);
    execute format('create policy %1$s_ins on public.%1$I for insert to authenticated with check (public.has_perm(clinic_id, %2$L, ''create''))', rec.tbl, rec.module);
    execute format('create policy %1$s_upd on public.%1$I for update to authenticated using (public.has_perm(clinic_id, %2$L, ''edit'')) with check (public.has_perm(clinic_id, %2$L, ''edit''))', rec.tbl, rec.module);
    execute format('create policy %1$s_del on public.%1$I for delete to authenticated using (public.has_perm(clinic_id, %2$L, ''delete''))', rec.tbl, rec.module);
  end loop;
end $$;

-- Enmiendas: solo lectura e inserción vía función
create policy amend_sel on public.consultation_amendments for select to authenticated
  using (public.has_perm(clinic_id, 'historias', 'view'));

-- Auditoría: solo lectura
create policy audit_sel on public.audit_log for select to authenticated
  using (public.has_perm(clinic_id, 'auditoria', 'view'));

-- ============ STORAGE (documentos privados por clínica) ============
insert into storage.buckets (id, name, public, file_size_limit)
values ('documentos', 'documentos', false, 10485760)
on conflict (id) do nothing;

create policy docs_read on storage.objects for select to authenticated
  using (bucket_id = 'documentos' and public.has_perm(((storage.foldername(name))[1])::uuid, 'pacientes', 'view'));
create policy docs_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'documentos' and public.has_perm(((storage.foldername(name))[1])::uuid, 'pacientes', 'edit'));
create policy docs_delete on storage.objects for delete to authenticated
  using (bucket_id = 'documentos' and public.has_perm(((storage.foldername(name))[1])::uuid, 'pacientes', 'delete'));

revoke execute on function public.seed_role_permissions(uuid) from public, anon, authenticated;
