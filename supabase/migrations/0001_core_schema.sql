-- Medvia · Esquema núcleo multi-tenant
create extension if not exists btree_gist with schema extensions;
create extension if not exists pgcrypto with schema extensions;

-- ============ ENUMS ============
create type public.clinic_role as enum (
  'admin_clinica','administrador','recepcionista','medico','enfermeria','laboratorio','farmacia','caja'
);
create type public.clinic_status as enum ('prueba','activa','suspendida','cancelada');
create type public.service_category as enum (
  'consulta','laboratorio','radiografia','ecografia','procedimiento','medicamento','internacion','otro'
);
create type public.insurance_status as enum ('activo','suspendido','vencido');
create type public.authorization_status as enum ('pendiente','en_revision','aprobada','rechazada','vencida');
create type public.appointment_status as enum ('pendiente','confirmada','en_espera','en_atencion','atendida','cancelada','ausente');
create type public.care_type as enum ('particular','seguro');
create type public.consultation_status as enum ('abierta','cerrada');
create type public.invoice_status as enum ('pendiente','parcial','pagada','anulada');
create type public.payment_method as enum ('efectivo','tarjeta_debito','tarjeta_credito','transferencia','cheque','otro');
create type public.settlement_status as enum ('borrador','presentada','pagada_parcial','pagada','rechazada');
create type public.settlement_item_status as enum ('incluido','aprobado','rechazado');

-- ============ PLATAFORMA ============
create table public.subscription_plans (
  id text primary key,
  name text not null,
  monthly_price numeric(14,2) not null default 0,
  max_users int,
  max_doctors int,
  created_at timestamptz not null default now()
);

create table public.clinics (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  legal_name text,
  ruc text,
  address text,
  city text,
  country text default 'Paraguay',
  phone text,
  email text,
  currency text not null default 'PYG',
  status public.clinic_status not null default 'prueba',
  subscription_plan text references public.subscription_plans(id) default 'basico',
  subscription_ends_at date,
  invoice_seq int not null default 0,
  settlement_seq int not null default 0,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create table public.platform_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  email text,
  phone text,
  created_at timestamptz not null default now()
);

create table public.clinic_members (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.clinic_role not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (clinic_id, user_id)
);
create index on public.clinic_members(user_id);

create table public.role_permissions (
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  role public.clinic_role not null,
  module text not null,
  can_view boolean not null default false,
  can_create boolean not null default false,
  can_edit boolean not null default false,
  can_delete boolean not null default false,
  primary key (clinic_id, role, module)
);

-- ============ CATÁLOGOS CLÍNICOS ============
create table public.specialties (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  name text not null,
  description text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (clinic_id, name)
);

create table public.rooms (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  name text not null,
  location text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (clinic_id, name)
);

create table public.doctors (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  full_name text not null,
  document text,
  license_number text not null,
  phone text,
  email text,
  room_id uuid references public.rooms(id) on delete set null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (clinic_id, license_number)
);
create index on public.doctors(clinic_id);

create table public.doctor_specialties (
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  doctor_id uuid not null references public.doctors(id) on delete cascade,
  specialty_id uuid not null references public.specialties(id) on delete cascade,
  primary key (doctor_id, specialty_id)
);

create table public.doctor_schedules (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  doctor_id uuid not null references public.doctors(id) on delete cascade,
  weekday smallint not null check (weekday between 0 and 6), -- 0 = domingo
  start_time time not null,
  end_time time not null,
  room_id uuid references public.rooms(id) on delete set null,
  check (end_time > start_time)
);

create table public.services (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  code text,
  name text not null,
  category public.service_category not null default 'consulta',
  specialty_id uuid references public.specialties(id) on delete set null,
  price numeric(14,2) not null check (price >= 0),
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create index on public.services(clinic_id);

-- ============ PACIENTES ============
create table public.patients (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  first_name text not null,
  last_name text not null,
  document text not null,
  birth_date date,
  sex text check (sex in ('F','M','X')),
  phone text,
  email text,
  address text,
  city text,
  country text default 'Paraguay',
  emergency_contact_name text,
  emergency_contact_phone text,
  blood_type text check (blood_type in ('A+','A-','B+','B-','AB+','AB-','O+','O-')),
  allergies text,
  medical_history text,
  preexisting_conditions text,
  current_medications text,
  archived boolean not null default false,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (clinic_id, document)
);
create index on public.patients(clinic_id, last_name);
create index on public.patients(clinic_id, phone);

-- ============ ASEGURADORAS / PLANES ============
create table public.insurers (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  trade_name text not null,
  legal_name text,
  ruc text,
  address text,
  phone text,
  email text,
  admin_contact text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (clinic_id, trade_name)
);

create table public.insurance_plans (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  insurer_id uuid not null references public.insurers(id) on delete cascade,
  name text not null,
  deductible numeric(14,2) not null default 0,
  annual_limit numeric(14,2),
  notes text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (insurer_id, name)
);

-- Cobertura configurable por plan y categoría (opcionalmente por especialidad)
create table public.plan_coverages (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  plan_id uuid not null references public.insurance_plans(id) on delete cascade,
  category public.service_category not null,
  specialty_id uuid references public.specialties(id) on delete cascade,
  covered boolean not null default true,
  coverage_percent numeric(5,2) not null default 0 check (coverage_percent between 0 and 100),
  copay numeric(14,2) not null default 0 check (copay >= 0),
  max_amount numeric(14,2),
  annual_quantity_limit int,
  requires_authorization boolean not null default false,
  notes text
);
create unique index plan_coverages_uniq on public.plan_coverages
  (plan_id, category, coalesce(specialty_id, '00000000-0000-0000-0000-000000000000'::uuid));

create table public.patient_insurances (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  patient_id uuid not null references public.patients(id) on delete cascade,
  insurer_id uuid not null references public.insurers(id),
  plan_id uuid not null references public.insurance_plans(id),
  member_number text not null,
  policy_number text,
  holder_name text,
  relationship text default 'Titular',
  start_date date not null,
  end_date date,
  status public.insurance_status not null default 'activo',
  card_path text,
  notes text,
  created_at timestamptz not null default now(),
  unique (clinic_id, insurer_id, member_number)
);
create index on public.patient_insurances(patient_id);

-- ============ AUTORIZACIONES ============
create table public.authorizations (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  patient_id uuid not null references public.patients(id) on delete cascade,
  patient_insurance_id uuid not null references public.patient_insurances(id),
  service_id uuid references public.services(id),
  service_description text not null,
  doctor_id uuid references public.doctors(id),
  request_number text,
  request_date date not null default current_date,
  response_date date,
  authorization_number text,
  valid_until date,
  status public.authorization_status not null default 'pendiente',
  notes text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);
create index on public.authorizations(clinic_id, status);

-- ============ AGENDA ============
create table public.appointments (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  patient_id uuid not null references public.patients(id) on delete cascade,
  doctor_id uuid not null references public.doctors(id),
  specialty_id uuid references public.specialties(id),
  room_id uuid references public.rooms(id),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  reason text,
  care_type public.care_type not null default 'particular',
  patient_insurance_id uuid references public.patient_insurances(id),
  status public.appointment_status not null default 'pendiente',
  notes text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  check (ends_at > starts_at),
  check (care_type = 'particular' or patient_insurance_id is not null),
  constraint appointments_no_overlap_doctor exclude using gist (
    doctor_id with =, tstzrange(starts_at, ends_at) with &&
  ) where (status not in ('cancelada','ausente')),
  constraint appointments_no_overlap_room exclude using gist (
    room_id with =, tstzrange(starts_at, ends_at) with &&
  ) where (status not in ('cancelada','ausente') and room_id is not null)
);
create index on public.appointments(clinic_id, starts_at);

-- ============ HISTORIA CLÍNICA ============
create table public.consultations (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  patient_id uuid not null references public.patients(id) on delete cascade,
  doctor_id uuid not null references public.doctors(id),
  specialty_id uuid references public.specialties(id),
  appointment_id uuid references public.appointments(id) on delete set null,
  consulted_at timestamptz not null default now(),
  reason text not null,
  symptoms text,
  background text,
  bp_systolic smallint,
  bp_diastolic smallint,
  temperature numeric(4,1),
  heart_rate smallint,
  respiratory_rate smallint,
  oxygen_saturation smallint,
  weight_kg numeric(5,2),
  height_cm numeric(5,1),
  diagnosis text,
  diagnosis_code text,
  observations text,
  treatment text,
  instructions text,
  evolution text,
  status public.consultation_status not null default 'abierta',
  closed_at timestamptz,
  closed_by uuid references auth.users(id),
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.consultations(clinic_id, consulted_at desc);
create index on public.consultations(patient_id);

create table public.consultation_amendments (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  consultation_id uuid not null references public.consultations(id) on delete cascade,
  field text not null,
  old_value text,
  new_value text,
  reason text not null,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

-- ============ FACTURACIÓN ============
create table public.invoices (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  number text not null,
  patient_id uuid not null references public.patients(id),
  care_type public.care_type not null,
  patient_insurance_id uuid references public.patient_insurances(id),
  insurer_id uuid references public.insurers(id),
  appointment_id uuid references public.appointments(id) on delete set null,
  consultation_id uuid references public.consultations(id) on delete set null,
  issue_date date not null default current_date,
  subtotal numeric(14,2) not null default 0,
  discount numeric(14,2) not null default 0,
  total numeric(14,2) not null default 0,
  insurer_amount numeric(14,2) not null default 0,
  patient_amount numeric(14,2) not null default 0,
  patient_paid numeric(14,2) not null default 0,
  status public.invoice_status not null default 'pendiente',
  notes text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  unique (clinic_id, number)
);
create index on public.invoices(clinic_id, issue_date desc);

create table public.invoice_items (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  invoice_id uuid not null references public.invoices(id) on delete cascade,
  service_id uuid references public.services(id),
  description text not null,
  category public.service_category not null,
  quantity int not null default 1 check (quantity > 0),
  unit_price numeric(14,2) not null,
  line_total numeric(14,2) not null,
  covered boolean not null default false,
  coverage_percent numeric(5,2) not null default 0,
  copay numeric(14,2) not null default 0,
  insurer_amount numeric(14,2) not null default 0,
  patient_amount numeric(14,2) not null default 0,
  authorization_id uuid references public.authorizations(id),
  coverage_note text
);
create index on public.invoice_items(invoice_id);

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  invoice_id uuid not null references public.invoices(id) on delete cascade,
  amount numeric(14,2) not null, -- negativo = devolución
  method public.payment_method not null,
  reference text,
  is_refund boolean not null default false,
  notes text,
  paid_at timestamptz not null default now(),
  received_by uuid references auth.users(id)
);
create index on public.payments(clinic_id, paid_at desc);

create table public.insurer_settlements (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  insurer_id uuid not null references public.insurers(id),
  number text not null,
  period_start date not null,
  period_end date not null,
  status public.settlement_status not null default 'borrador',
  external_invoice_number text,
  total_claimed numeric(14,2) not null default 0,
  total_rejected numeric(14,2) not null default 0,
  total_paid numeric(14,2) not null default 0,
  submitted_at date,
  notes text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  unique (clinic_id, number)
);

create table public.settlement_items (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  settlement_id uuid not null references public.insurer_settlements(id) on delete cascade,
  invoice_item_id uuid not null references public.invoice_items(id) unique,
  amount numeric(14,2) not null,
  status public.settlement_item_status not null default 'incluido',
  rejected_amount numeric(14,2) not null default 0,
  rejection_reason text
);

create table public.insurer_payments (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  settlement_id uuid not null references public.insurer_settlements(id) on delete cascade,
  amount numeric(14,2) not null check (amount > 0),
  paid_at date not null default current_date,
  reference text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

-- ============ AUDITORÍA ============
create table public.audit_log (
  id bigint generated always as identity primary key,
  clinic_id uuid references public.clinics(id) on delete cascade,
  user_id uuid,
  table_name text not null,
  record_id uuid,
  action text not null,
  old_data jsonb,
  new_data jsonb,
  created_at timestamptz not null default now()
);
create index on public.audit_log(clinic_id, created_at desc);
create index on public.audit_log(record_id);
