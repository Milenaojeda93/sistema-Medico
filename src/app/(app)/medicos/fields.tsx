import { Field, Input, Select } from "@/components/ui";

type D = Record<string, unknown> | null | undefined;
export function DoctorFields({ d, rooms, specialties, selected, users }: { d?: D; rooms: { id: string; name: string }[]; specialties: { id: string; name: string }[]; selected: string[]; users: { user_id: string; full_name: string | null; email: string }[] }) {
  const v = (k: string) => (d?.[k] as string) ?? "";
  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Field label="Nombre completo" name="full_name" required><Input name="full_name" defaultValue={v("full_name")} required /></Field>
        <Field label="Documento" name="document"><Input name="document" defaultValue={v("document")} /></Field>
        <Field label="Matrícula profesional" name="license_number" required><Input name="license_number" defaultValue={v("license_number")} required /></Field>
        <Field label="Teléfono" name="phone"><Input name="phone" defaultValue={v("phone")} /></Field>
        <Field label="Correo" name="email"><Input name="email" type="email" defaultValue={v("email")} /></Field>
        <Field label="Costo de consulta particular (Gs)" name="consultation_fee" hint="Se muestra al agendar. Vacío = precio del servicio de consulta">
          <Input name="consultation_fee" type="number" min={0} step={1000} inputMode="numeric" placeholder="Ej.: 250000" defaultValue={d?.consultation_fee != null ? String(Number(d.consultation_fee)) : ""} />
        </Field>
        <Field label="Consultorio habitual" name="room_id">
          <Select name="room_id" defaultValue={v("room_id")}><option value="">—</option>{rooms.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}</Select>
        </Field>
        <Field label="Usuario del sistema vinculado" name="user_id" hint="Permite preseleccionarlo al registrar consultas">
          <Select name="user_id" defaultValue={v("user_id")}><option value="">Sin usuario</option>{v("user_id") && !users.some((u) => u.user_id === v("user_id")) && <option value={v("user_id")}>Usuario vinculado</option>}{users.map((u) => <option key={u.user_id} value={u.user_id}>{u.full_name ?? u.email}</option>)}</Select>
        </Field>
      </div>
      <div>
        <p className="label">Especialidades</p>
        <div className="flex flex-wrap gap-2">
          {specialties.map((s) => (
            <label key={s.id} className="flex cursor-pointer items-center gap-2 rounded-lg border border-slate-200 px-3 py-1.5 text-sm has-[:checked]:border-primary-500 has-[:checked]:bg-primary-50">
              <input type="checkbox" name="specialties" value={s.id} defaultChecked={selected.includes(s.id)} className="rounded border-slate-300" /> {s.name}
            </label>
          ))}
        </div>
      </div>
    </div>
  );
}
