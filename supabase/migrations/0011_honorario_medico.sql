-- Costo de la consulta particular por profesional (se muestra al agendar).
alter table public.doctors add column if not exists consultation_fee numeric(14,2) check (consultation_fee >= 0);
comment on column public.doctors.consultation_fee is 'Costo de la consulta particular (Gs). Si está vacío se usa el precio del servicio de consulta de la especialidad.';
