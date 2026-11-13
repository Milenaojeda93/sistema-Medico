import { Field, Input, Select } from "@/components/ui";

type P = { name?: string; generic_name?: string | null; presentation?: string | null; category?: string; unit?: string; min_stock?: number; sale_price?: number | null };

export function ProductFields({ p = {} }: { p?: P }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Field label="Nombre comercial" name="name" required className="sm:col-span-2"><Input name="name" required defaultValue={p.name ?? ""} placeholder="Ej.: Paracetamol 500 mg" /></Field>
      <Field label="Principio activo / genérico" name="generic_name"><Input name="generic_name" defaultValue={p.generic_name ?? ""} placeholder="Ej.: Paracetamol" /></Field>
      <Field label="Presentación" name="presentation"><Input name="presentation" defaultValue={p.presentation ?? ""} placeholder="Ej.: Caja x 20 comprimidos" /></Field>
      <Field label="Categoría" name="category">
        <Select name="category" defaultValue={p.category ?? "medicamento"}><option value="medicamento">Medicamento</option><option value="insumo">Insumo médico</option><option value="otro">Otro</option></Select>
      </Field>
      <Field label="Unidad de medida" name="unit"><Input name="unit" defaultValue={p.unit ?? "unidad"} placeholder="comprimido, caja, frasco…" /></Field>
      <Field label="Stock mínimo (alerta)" name="min_stock"><Input name="min_stock" type="number" min={0} step="any" defaultValue={p.min_stock ?? 0} /></Field>
      <Field label="Precio de venta (Gs.)" name="sale_price"><Input name="sale_price" type="number" min={0} step="any" defaultValue={p.sale_price ?? ""} /></Field>
    </div>
  );
}

export function ReceiveFields({ suppliers }: { suppliers: { id: string; name: string }[] }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Field label="Lote" name="lot"><Input name="lot" placeholder="Opcional" /></Field>
      <Field label="Vencimiento" name="expires_on"><Input name="expires_on" type="date" /></Field>
      <Field label="Costo unitario (Gs.)" name="unit_cost"><Input name="unit_cost" type="number" min={0} step="any" /></Field>
      <Field label="Proveedor" name="supplier_id">
        <Select name="supplier_id" defaultValue=""><option value="">—</option>{suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</Select>
      </Field>
    </div>
  );
}
