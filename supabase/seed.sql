-- Medvia · Datos de demostración (dos clínicas para probar aislamiento)
-- Antes de ejecutar, reemplazá CAMBIAR_CONTRASEÑA por una contraseña segura.
create or replace function pg_temp.mk_user(p_email text, p_name text) returns uuid language plpgsql as $$
declare v uuid := gen_random_uuid();
begin
  insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data,
    raw_user_meta_data, created_at, updated_at, confirmation_token, recovery_token, email_change_token_new, email_change)
  values ('00000000-0000-0000-0000-000000000000', v, 'authenticated', 'authenticated', p_email,
    extensions.crypt('CAMBIAR_CONTRASEÑA', extensions.gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}',
    jsonb_build_object('full_name', p_name), now(), now(), '', '', '', '');
  insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
  values (gen_random_uuid(), v, v::text, jsonb_build_object('sub', v::text, 'email', p_email, 'email_verified', true), 'email', now(), now(), now());
  return v;
end $$;

create or replace function pg_temp.act_as(p uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', p, 'role', 'authenticated')::text, false);
$$;

do $$
declare
  u_admin uuid; u_med uuid; u_rec uuid; u_super uuid; u_admin2 uuid;
  c1 uuid; c2 uuid;
  s_cm uuid; s_ped uuid; s_gin uuid; s_car uuid; s_tra uuid; s_der uuid;
  r1 uuid; r2 uuid;
  d1 uuid; d2 uuid; d3 uuid; d4 uuid; docs uuid[];
  i1 uuid; i2 uuid; i3 uuid; p1 uuid; p2 uuid; p3 uuid; p4 uuid;
  pat uuid; pats uuid[] := '{}'; pi uuid; pis uuid[] := '{}';
  svc_con uuid; svc_esp uuid; svc_lab uuid; svc_eco uuid;
  fn text[] := array['María José','Carlos','Ana Belén','Luis Alberto','Rosa','Jorge','Liz','Diego','Gabriela','Marcos',
                     'Sofía','Hugo','Andrea','Ramón','Natalia','Pablo','Fátima','Rodrigo','Lorena','Sergio',
                     'Camila','Néstor','Verónica','Óscar','Paola','Julio','Mirna','Fernando'];
  ln text[] := array['Benítez','González','Ramírez','Giménez','Duarte','Martínez','Villalba','Ortiz','Cáceres','Rojas',
                     'Fernández','Acosta','Báez','López','Sanabria','Aquino','Cabrera','Insfrán','Escobar','Vera',
                     'Galeano','Núñez','Torres','Ayala','Ruiz Díaz','Espínola','Brítez','Riveros'];
  i int; k int; v_start timestamptz; v_doc uuid; v_spec uuid; v_appt uuid; v_cons uuid; v_inv uuid; v_pi uuid; v_status public.appointment_status;
  diag text[] := array['Faringitis aguda','Hipertensión arterial esencial','Lumbalgia mecánica','Gastroenteritis aguda',
                       'Dermatitis atópica','Infección urinaria baja','Control de embarazo normal','Rinitis alérgica',
                       'Esguince de tobillo','Cefalea tensional'];
  dcode text[] := array['J02.9','I10','M54.5','A09','L20.9','N39.0','Z34.9','J30.4','S93.4','G44.2'];
begin
  u_admin := pg_temp.mk_user('admin@clinicademo.com.py', 'Laura Méndez');
  u_med := pg_temp.mk_user('medico@clinicademo.com.py', 'Dr. Ricardo Paredes');
  u_rec := pg_temp.mk_user('recepcion@clinicademo.com.py', 'Carmen Ojeda');
  u_super := pg_temp.mk_user('superadmin@medicalsys.com.py', 'Superadministrador Medvia');
  u_admin2 := pg_temp.mk_user('admin@centronorte.com.py', 'Patricia Sosa');
  insert into public.platform_admins(user_id) values (u_super);

  -- Clínica 1
  perform pg_temp.act_as(u_admin);
  c1 := public.create_clinic('Clínica San Rafael', '80012345-6', '021 600 100', 'contacto@clinicademo.com.py', 'Asunción', 'Av. Mcal. López 1234');
  update public.clinics set status = 'activa', subscription_plan = 'profesional', subscription_ends_at = current_date + 365 where id = c1;
  insert into public.clinic_members(clinic_id, user_id, role) values (c1, u_med, 'medico'), (c1, u_rec, 'recepcionista');

  select id into s_cm from specialties where clinic_id = c1 and name = 'Clínica médica';
  select id into s_ped from specialties where clinic_id = c1 and name = 'Pediatría';
  select id into s_gin from specialties where clinic_id = c1 and name = 'Ginecología';
  select id into s_car from specialties where clinic_id = c1 and name = 'Cardiología';
  select id into s_tra from specialties where clinic_id = c1 and name = 'Traumatología';
  select id into s_der from specialties where clinic_id = c1 and name = 'Dermatología';
  select id into r1 from rooms where clinic_id = c1 and name = 'Consultorio 1';
  select id into r2 from rooms where clinic_id = c1 and name = 'Consultorio 2';
  insert into rooms(clinic_id, name) values (c1, 'Consultorio 3');
  select id into svc_con from services where clinic_id = c1 and code = 'CON-01';
  select id into svc_esp from services where clinic_id = c1 and code = 'CON-02';
  select id into svc_lab from services where clinic_id = c1 and code = 'LAB-01';
  select id into svc_eco from services where clinic_id = c1 and code = 'ECO-01';

  insert into doctors(clinic_id, user_id, full_name, document, license_number, phone, email, room_id)
    values (c1, u_med, 'Dr. Ricardo Paredes', '2345678', 'MP-10234', '0981 111 222', 'medico@clinicademo.com.py', r1) returning id into d1;
  insert into doctors(clinic_id, full_name, document, license_number, phone, email, room_id)
    values (c1, 'Dra. Silvia Benegas', '3456789', 'MP-11876', '0982 333 444', 'sbenegas@clinicademo.com.py', r2) returning id into d2;
  insert into doctors(clinic_id, full_name, document, license_number, phone, email, room_id)
    values (c1, 'Dr. Martín Coronel', '4567890', 'MP-12450', '0983 555 666', 'mcoronel@clinicademo.com.py', r1) returning id into d3;
  insert into doctors(clinic_id, full_name, document, license_number, phone, email, room_id)
    values (c1, 'Dra. Elena Franco', '5678901', 'MP-13002', '0984 777 888', 'efranco@clinicademo.com.py', r2) returning id into d4;
  docs := array[d1,d2,d3,d4];
  insert into doctor_specialties(clinic_id, doctor_id, specialty_id) values
    (c1,d1,s_cm),(c1,d1,s_car),(c1,d2,s_ped),(c1,d3,s_tra),(c1,d4,s_gin),(c1,d4,s_der);
  -- Horarios lunes a viernes (Asunción: turnos mañana y tarde)
  for k in 1..5 loop
    insert into doctor_schedules(clinic_id, doctor_id, weekday, start_time, end_time, room_id) values
      (c1, d1, k, '07:00', '12:00', r1), (c1, d2, k, '13:00', '19:00', r2),
      (c1, d3, k, '14:00', '19:00', r1), (c1, d4, k, '07:00', '12:00', r2);
  end loop;
  insert into doctor_schedules(clinic_id, doctor_id, weekday, start_time, end_time, room_id) values (c1, d1, 6, '08:00', '12:00', r1);

  -- Aseguradoras y planes (nombres ficticios)
  insert into insurers(clinic_id, trade_name, legal_name, ruc, phone, email, admin_contact)
    values (c1, 'Salud Total PY', 'Salud Total Paraguay S.A.', '80098765-1', '021 450 000', 'prestadores@saludtotal.example', 'Lic. Mónica Ríos')
    returning id into i1;
  insert into insurers(clinic_id, trade_name, legal_name, ruc, phone, email, admin_contact)
    values (c1, 'MediPlus', 'MediPlus Medicina Prepaga S.A.', '80055555-2', '021 330 300', 'convenios@mediplus.example', 'Sr. Hernán Godoy')
    returning id into i2;
  insert into insurers(clinic_id, trade_name, legal_name, ruc, phone, email, admin_contact)
    values (c1, 'Previsión Familiar', 'Previsión Familiar Coop. Ltda.', '80077777-3', '021 210 210', 'auditoria@prevfam.example', 'Dra. Norma Leiva')
    returning id into i3;

  insert into insurance_plans(clinic_id, insurer_id, name, deductible, annual_limit) values (c1, i1, 'Plan Oro', 0, 50000000) returning id into p1;
  insert into insurance_plans(clinic_id, insurer_id, name, deductible, annual_limit) values (c1, i1, 'Plan Plata', 0, 25000000) returning id into p2;
  insert into insurance_plans(clinic_id, insurer_id, name, deductible) values (c1, i2, 'MediPlus Integral', 0) returning id into p3;
  insert into insurance_plans(clinic_id, insurer_id, name, deductible) values (c1, i3, 'Básico Familiar', 0) returning id into p4;

  insert into plan_coverages(clinic_id, plan_id, category, coverage_percent, copay, annual_quantity_limit, requires_authorization) values
    (c1, p1, 'consulta', 80, 0, 24, false), (c1, p1, 'laboratorio', 90, 0, null, false),
    (c1, p1, 'radiografia', 80, 0, null, false), (c1, p1, 'ecografia', 80, 0, null, true),
    (c1, p1, 'procedimiento', 70, 0, null, true), (c1, p1, 'internacion', 90, 0, null, true),
    (c1, p2, 'consulta', 70, 30000, 12, false), (c1, p2, 'laboratorio', 70, 0, null, false),
    (c1, p2, 'ecografia', 60, 0, null, true),
    (c1, p3, 'consulta', 100, 50000, null, false), (c1, p3, 'laboratorio', 80, 0, null, false),
    (c1, p3, 'radiografia', 80, 0, null, false), (c1, p3, 'ecografia', 80, 0, null, false),
    (c1, p4, 'consulta', 50, 0, 6, false);
  insert into plan_coverages(clinic_id, plan_id, category, covered, notes) values (c1, p4, 'laboratorio', false, 'No incluido en el plan básico');

  -- Pacientes repartidos en los últimos 6 meses
  for i in 1..28 loop
    insert into patients(clinic_id, first_name, last_name, document, birth_date, sex, phone, email, address, city,
      emergency_contact_name, emergency_contact_phone, blood_type, allergies, preexisting_conditions, current_medications, created_by, created_at)
    values (c1, fn[i], ln[i] || ' ' || ln[((i*7) % 28) + 1], (1500000 + i*137911)::text,
      date '1950-01-01' + ((i * 811) % 26000), case when i % 2 = 0 then 'M' else 'F' end,
      '098' || (1 + i % 6) || ' ' || lpad(((i*4271) % 1000)::text,3,'0') || ' ' || lpad(((i*919) % 1000)::text,3,'0'),
      translate(lower(split_part(fn[i],' ',1)),'áéíóúñ','aeioun') || '.' || translate(lower(replace(ln[i],' ','')),'áéíóúñ','aeioun') || '@correo.example',
      'Calle ' || (100 + i) || ' c/ Mcal. Estigarribia', case when i % 3 = 0 then 'San Lorenzo' when i % 3 = 1 then 'Asunción' else 'Luque' end,
      'Familiar de ' || fn[i], '0991 ' || lpad((i*313 % 1000)::text,3,'0') || ' 000',
      (array['O+','A+','B+','O-','AB+','A-'])[1 + i % 6],
      case when i % 5 = 0 then 'Penicilina' when i % 7 = 0 then 'AINEs' else null end,
      case when i % 4 = 0 then 'Hipertensión' when i % 6 = 0 then 'Diabetes tipo 2' else null end,
      case when i % 4 = 0 then 'Losartán 50 mg/día' else null end,
      u_rec, now() - ((180 - i*6) || ' days')::interval)
    returning id into pat;
    pats := pats || pat;
    if i % 3 <> 0 then
      insert into patient_insurances(clinic_id, patient_id, insurer_id, plan_id, member_number, policy_number, holder_name, relationship, start_date, end_date, status)
      values (c1, pat,
        case i % 4 when 0 then i1 when 1 then i1 when 2 then i2 else i3 end,
        case i % 4 when 0 then p1 when 1 then p2 when 2 then p3 else p4 end,
        'AF-' || lpad((i*1009)::text, 7, '0'), 'POL-' || (2024000 + i), fn[i] || ' ' || ln[i], 'Titular',
        current_date - 400, case when i = 10 then current_date - 15 else current_date + 300 end,
        case when i = 11 then 'suspendido' else 'activo' end::public.insurance_status)
      returning id into pi;
    else
      pi := null;
    end if;
    pis := pis || pi;
  end loop;

  -- Autorizaciones
  insert into authorizations(clinic_id, patient_id, patient_insurance_id, service_id, service_description, doctor_id, request_number, request_date, response_date, authorization_number, valid_until, status, created_by)
  values (c1, pats[4], pis[4], svc_eco, 'Ecografía abdominal', d1, 'SOL-0001', current_date - 6, current_date - 4, 'AUT-55821', current_date + 25, 'aprobada', u_rec),
         (c1, pats[8], pis[8], svc_eco, 'Ecografía abdominal', d1, 'SOL-0002', current_date - 2, null, null, null, 'en_revision', u_rec),
         (c1, pats[2], pis[2], null, 'Resonancia magnética de rodilla', d3, 'SOL-0003', current_date - 1, null, null, null, 'pendiente', u_rec),
         (c1, pats[5], pis[5], svc_eco, 'Ecografía abdominal', d4, 'SOL-0004', current_date - 20, current_date - 18, null, null, 'rechazada', u_rec);

  -- Citas: últimas 4 semanas (atendidas/ausentes/canceladas) + próximas 2 semanas
  perform pg_temp.act_as(u_med);
  for i in 0..55 loop
    k := 1 + (i % 28);
    v_doc := docs[1 + (i % 4)];
    v_spec := case 1 + (i % 4) when 1 then (case when i % 8 = 0 then s_car else s_cm end) when 2 then s_ped when 3 then s_tra else (case when i % 8 = 3 then s_der else s_gin end) end;
    v_start := date_trunc('day', now() at time zone 'America/Asuncion') - ((28 - (i / 2)) || ' days')::interval
               + (case 1 + (i % 4) when 1 then '08:00' when 2 then '14:00' when 3 then '15:00' else '09:00' end)::interval
               + ((i % 3) * 30 || ' minutes')::interval;
    v_start := (v_start::timestamp at time zone 'America/Asuncion');
    if extract(dow from v_start at time zone 'America/Asuncion') in (0) then v_start := v_start + interval '1 day'; end if;
    v_pi := pis[k];
    v_status := case when i % 13 = 5 then 'ausente' when i % 11 = 7 then 'cancelada' else 'atendida' end;
    begin
      insert into appointments(clinic_id, patient_id, doctor_id, specialty_id, room_id, starts_at, ends_at, reason, care_type, patient_insurance_id, status, created_by)
      values (c1, pats[k], v_doc, v_spec, (select room_id from doctors where id = v_doc), v_start, v_start + interval '30 minutes',
        'Consulta de control', case when v_pi is null then 'particular' else 'seguro' end::public.care_type, v_pi, v_status, u_rec)
      returning id into v_appt;
    exception when exclusion_violation then continue;
    end;
    if v_status = 'atendida' then
      insert into consultations(clinic_id, patient_id, doctor_id, specialty_id, appointment_id, consulted_at, reason, symptoms,
        bp_systolic, bp_diastolic, temperature, heart_rate, respiratory_rate, oxygen_saturation, weight_kg, height_cm,
        diagnosis, diagnosis_code, treatment, instructions, created_by)
      values (c1, pats[k], v_doc, v_spec, v_appt, v_start + interval '5 minutes', 'Consulta de control',
        'Refiere malestar general de ' || (1 + i % 5) || ' días de evolución',
        110 + (i*7 % 40), 70 + (i*3 % 20), 36.2 + (i % 8) / 10.0, 64 + (i*5 % 30), 14 + (i % 6), 95 + (i % 5),
        55 + (i*3 % 40), 150 + (i*7 % 35), diag[1 + i % 10], dcode[1 + i % 10],
        'Tratamiento sintomático y control', 'Hidratación abundante. Volver si persisten los síntomas.', u_med)
      returning id into v_cons;
      perform public.close_consultation(v_cons);
    end if;
  end loop;

  -- Citas futuras
  for i in 0..21 loop
    k := 1 + ((i * 5) % 28);
    v_doc := docs[1 + (i % 4)];
    v_spec := case 1 + (i % 4) when 1 then s_cm when 2 then s_ped when 3 then s_tra else s_gin end;
    v_start := ((date_trunc('day', now() at time zone 'America/Asuncion') + ((i / 3) || ' days')::interval
               + (case 1 + (i % 4) when 1 then '08:00' when 2 then '14:00' when 3 then '15:30' else '09:30' end)::interval
               + ((i % 3) * 30 || ' minutes')::interval)::timestamp at time zone 'America/Asuncion');
    if v_start < now() then v_start := v_start + interval '1 day'; end if;
    if extract(dow from v_start at time zone 'America/Asuncion') = 0 then v_start := v_start + interval '1 day'; end if;
    v_pi := pis[k];
    begin
      insert into appointments(clinic_id, patient_id, doctor_id, specialty_id, room_id, starts_at, ends_at, reason, care_type, patient_insurance_id, status, created_by)
      values (c1, pats[k], v_doc, v_spec, (select room_id from doctors where id = v_doc), v_start, v_start + interval '30 minutes',
        (array['Control anual','Dolor lumbar','Fiebre','Control pediátrico','Chequeo cardiológico','Consulta ginecológica'])[1 + i % 6],
        case when v_pi is null then 'particular' else 'seguro' end::public.care_type, v_pi,
        case when i % 3 = 0 then 'confirmada' else 'pendiente' end::public.appointment_status, u_rec);
    exception when exclusion_violation then null;
    end;
  end loop;

  -- Facturación: una factura por consulta cerrada, con cobros
  perform pg_temp.act_as(u_admin);
  for v_cons, k in
    select c.id, array_position(pats, c.patient_id) from consultations c where c.clinic_id = c1 order by c.consulted_at
  loop
    select a.patient_insurance_id into v_pi from consultations c join appointments a on a.id = c.appointment_id where c.id = v_cons;
    v_inv := public.create_invoice(c1, pats[k], v_pi,
      case when k % 5 = 0 then jsonb_build_array(jsonb_build_object('service_id', svc_con), jsonb_build_object('service_id', svc_lab))
           when k = 4 then jsonb_build_array(jsonb_build_object('service_id', svc_esp), jsonb_build_object('service_id', svc_eco))
           else jsonb_build_array(jsonb_build_object('service_id', case when k % 2 = 0 then svc_esp else svc_con end)) end,
      0, (select appointment_id from consultations where id = v_cons), v_cons);
    update invoices set issue_date = (select (consulted_at at time zone 'America/Asuncion')::date from consultations where id = v_cons) where id = v_inv;
    if k % 6 <> 1 and (select patient_amount from invoices where id = v_inv) > 0 then
      perform public.register_payment(v_inv, (select patient_amount from invoices where id = v_inv),
        (array['efectivo','tarjeta_debito','transferencia','tarjeta_credito'])[1 + k % 4]::public.payment_method);
    end if;
  end loop;
  update payments p set paid_at = ((select issue_date from invoices where id = p.invoice_id) + time '11:00') at time zone 'America/Asuncion'
  where clinic_id = c1;

  -- Liquidación a Salud Total del período anterior
  begin
    v_inv := public.create_settlement(c1, i1, current_date - 40, current_date - 10, 'Liquidación demo');
    perform public.submit_settlement(v_inv, '001-001-0004521');
    perform public.reject_settlement_item((select id from settlement_items where settlement_id = v_inv order by amount desc limit 1), 50000, 'Falta firma del afiliado en la orden');
    perform public.register_insurer_payment(v_inv, (select (total_claimed - total_rejected) / 2 from insurer_settlements where id = v_inv), current_date - 2, 'TRF-778812');
  exception when others then raise notice 'Liquidación omitida: %', sqlerrm;
  end;

  -- Clínica 2 (para validar aislamiento)
  perform pg_temp.act_as(u_admin2);
  c2 := public.create_clinic('Centro Médico Norte', '80044444-0', '021 900 900', 'info@centronorte.com.py', 'Mariano Roque Alonso');
  insert into patients(clinic_id, first_name, last_name, document, birth_date, sex, phone)
  values (c2, 'Paciente', 'De Otra Clínica', '9999999', '1980-05-05', 'F', '0985 000 000');
end $$;

select set_config('request.jwt.claims', '', false);
