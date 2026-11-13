-- Medvia · Farmacia e Inventario (productos, proveedores, lotes con vencimiento, movimientos, dispensación de recetas)

create table public.suppliers (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  name text not null,
  ruc text,
  phone text,
  email text,
  contact text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (clinic_id, name)
);

create table public.products (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  name text not null,
  generic_name text,
  presentation text,
  category text not null default 'medicamento' check (category in ('medicamento','insumo','otro')),
  unit text not null default 'unidad',
  min_stock numeric(12,2) not null default 0 check (min_stock >= 0),
  sale_price numeric(14,2) check (sale_price >= 0),
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create index on public.products(clinic_id, name);

create table public.stock_lots (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  lot_number text,
  expires_on date,
  quantity numeric(12,2) not null default 0 check (quantity >= 0),
  unit_cost numeric(14,2),
  supplier_id uuid references public.suppliers(id) on delete set null,
  received_at timestamptz not null default now()
);
create index on public.stock_lots(product_id);
create index on public.stock_lots(clinic_id, expires_on);

create table public.dispensations (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  prescription_id uuid not null references public.prescriptions(id),
  patient_id uuid not null references public.patients(id) on delete cascade,
  notes text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);
create index on public.dispensations(prescription_id);

create table public.stock_movements (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  lot_id uuid references public.stock_lots(id) on delete set null,
  kind text not null check (kind in ('entrada','salida','ajuste','dispensacion')),
  quantity numeric(12,2) not null,
  reason text,
  supplier_id uuid references public.suppliers(id) on delete set null,
  dispensation_id uuid references public.dispensations(id) on delete set null,
  patient_id uuid references public.patients(id) on delete set null,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);
create index on public.stock_movements(clinic_id, created_at desc);
create index on public.stock_movements(product_id);

create trigger chk_lots before insert or update on public.stock_lots for each row
  execute function public.enforce_same_clinic('product_id','products','supplier_id','suppliers');
create trigger chk_movs before insert or update on public.stock_movements for each row
  execute function public.enforce_same_clinic('product_id','products','lot_id','stock_lots','supplier_id','suppliers','patient_id','patients');
create trigger chk_disp before insert or update on public.dispensations for each row
  execute function public.enforce_same_clinic('prescription_id','prescriptions','patient_id','patients');

create trigger audit_suppliers after insert or update or delete on public.suppliers for each row execute function public.audit_trigger();
create trigger audit_products after insert or update or delete on public.products for each row execute function public.audit_trigger();
create trigger audit_stock_movements after insert or update or delete on public.stock_movements for each row execute function public.audit_trigger();
create trigger audit_dispensations after insert or update or delete on public.dispensations for each row execute function public.audit_trigger();

alter table public.suppliers enable row level security;
alter table public.products enable row level security;
alter table public.stock_lots enable row level security;
alter table public.stock_movements enable row level security;
alter table public.dispensations enable row level security;

-- Lectura: inventario o farmacia
create policy suppliers_sel on public.suppliers for select to authenticated
  using (public.has_perm(clinic_id, 'inventario', 'view') or public.has_perm(clinic_id, 'farmacia', 'view'));
create policy products_sel on public.products for select to authenticated
  using (public.has_perm(clinic_id, 'inventario', 'view') or public.has_perm(clinic_id, 'farmacia', 'view'));
create policy lots_sel on public.stock_lots for select to authenticated
  using (public.has_perm(clinic_id, 'inventario', 'view') or public.has_perm(clinic_id, 'farmacia', 'view'));
create policy movs_sel on public.stock_movements for select to authenticated
  using (public.has_perm(clinic_id, 'inventario', 'view') or public.has_perm(clinic_id, 'farmacia', 'view'));
create policy disp_sel on public.dispensations for select to authenticated
  using (public.has_perm(clinic_id, 'farmacia', 'view') or public.has_perm(clinic_id, 'recetas', 'view'));

-- Catálogos editables directamente
create policy products_ins on public.products for insert to authenticated with check (public.has_perm(clinic_id, 'inventario', 'create'));
create policy products_upd on public.products for update to authenticated
  using (public.has_perm(clinic_id, 'inventario', 'edit')) with check (public.has_perm(clinic_id, 'inventario', 'edit'));
create policy suppliers_ins on public.suppliers for insert to authenticated
  with check (public.has_perm(clinic_id, 'inventario', 'create') or public.has_perm(clinic_id, 'farmacia', 'create'));
create policy suppliers_upd on public.suppliers for update to authenticated
  using (public.has_perm(clinic_id, 'inventario', 'edit') or public.has_perm(clinic_id, 'farmacia', 'edit'))
  with check (public.has_perm(clinic_id, 'inventario', 'edit') or public.has_perm(clinic_id, 'farmacia', 'edit'));
-- Lotes, movimientos y dispensaciones: solo mediante las funciones de abajo.

-- Ingreso de mercadería
create or replace function public.receive_stock(
  p_clinic uuid, p_product uuid, p_quantity numeric, p_lot text default null, p_expires date default null,
  p_cost numeric default null, p_supplier uuid default null, p_reason text default null)
returns uuid language plpgsql security definer set search_path = public as $fn$
declare v_lot uuid;
begin
  perform public.require_perm(p_clinic, 'inventario', 'create');
  if not exists (select 1 from public.products where id = p_product and clinic_id = p_clinic) then raise exception 'Producto inválido'; end if;
  if coalesce(p_quantity, 0) <= 0 then raise exception 'La cantidad debe ser mayor a cero'; end if;
  select id into v_lot from public.stock_lots
   where product_id = p_product and clinic_id = p_clinic
     and coalesce(lot_number, '') = coalesce(nullif(trim(p_lot), ''), '')
     and expires_on is not distinct from p_expires
   limit 1;
  if v_lot is null then
    insert into public.stock_lots(clinic_id, product_id, lot_number, expires_on, quantity, unit_cost, supplier_id)
    values (p_clinic, p_product, nullif(trim(p_lot), ''), p_expires, p_quantity, p_cost, p_supplier) returning id into v_lot;
  else
    update public.stock_lots set quantity = quantity + p_quantity, unit_cost = coalesce(p_cost, unit_cost),
      supplier_id = coalesce(p_supplier, supplier_id) where id = v_lot;
  end if;
  insert into public.stock_movements(clinic_id, product_id, lot_id, kind, quantity, reason, supplier_id, created_by)
  values (p_clinic, p_product, v_lot, 'entrada', p_quantity, nullif(trim(p_reason), ''), p_supplier, auth.uid());
  return v_lot;
end $fn$;

-- Descuenta stock por lote, primero lo que vence antes (FEFO), sin usar lotes vencidos
create or replace function public.consume_stock(
  p_clinic uuid, p_product uuid, p_quantity numeric, p_kind text, p_reason text,
  p_dispensation uuid default null, p_patient uuid default null, p_lot uuid default null)
returns void language plpgsql security definer set search_path = public as $fn$
declare
  v_left numeric := p_quantity; v_take numeric; r record; v_name text;
begin
  if coalesce(p_quantity, 0) <= 0 then raise exception 'La cantidad debe ser mayor a cero'; end if;
  select name into v_name from public.products where id = p_product and clinic_id = p_clinic;
  if v_name is null then raise exception 'Producto inválido'; end if;
  for r in
    select id, quantity from public.stock_lots
     where product_id = p_product and clinic_id = p_clinic and quantity > 0
       and (p_lot is null or id = p_lot)
       and (p_kind <> 'dispensacion' or expires_on is null or expires_on >= current_date)
     order by expires_on nulls last, received_at
     for update
  loop
    exit when v_left <= 0;
    v_take := least(r.quantity, v_left);
    update public.stock_lots set quantity = quantity - v_take where id = r.id;
    insert into public.stock_movements(clinic_id, product_id, lot_id, kind, quantity, reason, dispensation_id, patient_id, created_by)
    values (p_clinic, p_product, r.id, p_kind, -v_take, nullif(trim(p_reason), ''), p_dispensation, p_patient, auth.uid());
    v_left := v_left - v_take;
  end loop;
  if v_left > 0 then
    raise exception 'Stock insuficiente de % (faltan %)', v_name, v_left;
  end if;
end $fn$;

-- Salidas y ajustes manuales (vencidos, roturas, uso interno, correcciones)
create or replace function public.withdraw_stock(
  p_clinic uuid, p_product uuid, p_quantity numeric, p_kind text, p_reason text, p_lot uuid default null)
returns void language plpgsql security definer set search_path = public as $fn$
begin
  perform public.require_perm(p_clinic, 'inventario', 'edit');
  if p_kind not in ('salida','ajuste') then raise exception 'Tipo de movimiento inválido'; end if;
  if coalesce(trim(p_reason), '') = '' then raise exception 'Indicá el motivo'; end if;
  perform public.consume_stock(p_clinic, p_product, p_quantity, p_kind, p_reason, null, null, p_lot);
end $fn$;

-- Dispensación de una receta: p_items = [{"product_id": "...", "quantity": 2}, ...]
create or replace function public.dispense_prescription(p_clinic uuid, p_prescription uuid, p_items jsonb, p_notes text default null)
returns uuid language plpgsql security definer set search_path = public as $fn$
declare
  v_rx public.prescriptions; v_id uuid; v_item jsonb;
begin
  perform public.require_perm(p_clinic, 'farmacia', 'create');
  select * into v_rx from public.prescriptions where id = p_prescription and clinic_id = p_clinic;
  if v_rx.id is null then raise exception 'Receta inválida'; end if;
  if v_rx.status <> 'emitida' then raise exception 'La receta está anulada'; end if;
  if jsonb_array_length(coalesce(p_items, '[]'::jsonb)) = 0 then raise exception 'Indicá al menos un producto a entregar'; end if;
  insert into public.dispensations(clinic_id, prescription_id, patient_id, notes, created_by)
  values (p_clinic, p_prescription, v_rx.patient_id, nullif(trim(p_notes), ''), auth.uid()) returning id into v_id;
  for v_item in select * from jsonb_array_elements(p_items) loop
    perform public.consume_stock(p_clinic, (v_item->>'product_id')::uuid, (v_item->>'quantity')::numeric,
      'dispensacion', 'Receta ' || v_rx.number, v_id, v_rx.patient_id, null);
  end loop;
  return v_id;
end $fn$;

revoke execute on function public.consume_stock(uuid, uuid, numeric, text, text, uuid, uuid, uuid) from authenticated, public, anon;
revoke execute on function public.receive_stock(uuid, uuid, numeric, text, date, numeric, uuid, text) from public, anon;
grant execute on function public.receive_stock(uuid, uuid, numeric, text, date, numeric, uuid, text) to authenticated;
revoke execute on function public.withdraw_stock(uuid, uuid, numeric, text, text, uuid) from public, anon;
grant execute on function public.withdraw_stock(uuid, uuid, numeric, text, text, uuid) to authenticated;
revoke execute on function public.dispense_prescription(uuid, uuid, jsonb, text) from public, anon;
grant execute on function public.dispense_prescription(uuid, uuid, jsonb, text) to authenticated;

-- Datos de demostración solo para las clínicas de prueba
do $fn$
declare
  c record; v_sup uuid; v_p uuid;
begin
  for c in select id from public.clinics where name in ('Clínica San Rafael', 'Centro Médico Norte')
                                           and not exists (select 1 from public.products p where p.clinic_id = clinics.id) loop
    insert into public.suppliers(clinic_id, name, ruc, phone, contact) values (c.id, 'Distribuidora Farmacéutica Demo', '80099999-1', '021 555 000', 'Ventas') returning id into v_sup;
    insert into public.products(clinic_id, name, generic_name, presentation, category, unit, min_stock, sale_price) values
      (c.id, 'Paracetamol 500 mg', 'Paracetamol', 'Comprimidos', 'medicamento', 'comprimido', 100, 500),
      (c.id, 'Ibuprofeno 400 mg', 'Ibuprofeno', 'Comprimidos', 'medicamento', 'comprimido', 100, 700),
      (c.id, 'Amoxicilina 500 mg', 'Amoxicilina', 'Cápsulas', 'medicamento', 'cápsula', 60, 1200),
      (c.id, 'Omeprazol 20 mg', 'Omeprazol', 'Cápsulas', 'medicamento', 'cápsula', 50, 900),
      (c.id, 'Losartán 50 mg', 'Losartán', 'Comprimidos', 'medicamento', 'comprimido', 60, 800),
      (c.id, 'Guantes de látex M', null, 'Caja x 100', 'insumo', 'caja', 5, 45000),
      (c.id, 'Jeringa 5 ml', null, 'Unidad', 'insumo', 'unidad', 50, 1500);
    for v_p in select id from public.products where clinic_id = c.id loop
      insert into public.stock_lots(clinic_id, product_id, lot_number, expires_on, quantity, unit_cost, supplier_id)
      values (c.id, v_p, 'L' || to_char(now(), 'YYMM') || '-' || substr(v_p::text, 1, 4), current_date + 420, 200, 300, v_sup);
    end loop;
    -- un lote por vencer y un producto con stock bajo, para ver las alertas
    update public.stock_lots set expires_on = current_date + 25, quantity = 40
     where product_id = (select id from public.products where clinic_id = c.id and name = 'Ibuprofeno 400 mg');
    update public.stock_lots set quantity = 3
     where product_id = (select id from public.products where clinic_id = c.id and name = 'Guantes de látex M');
    insert into public.stock_movements(clinic_id, product_id, lot_id, kind, quantity, reason, supplier_id)
    select clinic_id, product_id, id, 'entrada', quantity, 'Stock inicial (demostración)', supplier_id
      from public.stock_lots where clinic_id = c.id;
  end loop;
end $fn$;
