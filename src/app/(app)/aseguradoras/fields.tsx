import { Field, Input } from "@/components/ui";

export function InsurerFields({ i }: { i?: Record<string, unknown> | null }) {
  const v = (k: string) => (i?.[k] as string) ?? "";
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Field label="Nombre comercial" name="trade_name" required><Input name="trade_name" defaultValue={v("trade_name")} required /></Field>
      <Field label="Razón social" name="legal_name"><Input name="legal_name" defaultValue={v("legal_name")} /></Field>
      <Field label="RUC" name="ruc"><Input name="ruc" defaultValue={v("ruc")} /></Field>
      <Field label="Teléfono" name="phone"><Input name="phone" defaultValue={v("phone")} /></Field>
      <Field label="Correo electrónico" name="email"><Input name="email" type="email" defaultValue={v("email")} /></Field>
      <Field label="Contacto administrativo" name="admin_contact"><Input name="admin_contact" defaultValue={v("admin_contact")} /></Field>
      <Field label="Dirección" name="address" className="sm:col-span-2"><Input name="address" defaultValue={v("address")} /></Field>
    </div>
  );
}
