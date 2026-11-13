import { Field, Input, Select, Textarea } from "@/components/ui";
import { BLOOD_TYPES, CLINICAL_SUGGESTIONS as CS } from "@/lib/constants";
import { TagInput } from "@/components/ui/pickers";

type P = Record<string, string | null | boolean> | null;

export function PatientFields({ p, isNew }: { p?: P; isNew?: boolean }) {
  const v = (k: string) => (p?.[k] as string | null | undefined) ?? "";
  return (
    <div className="space-y-6">
      <fieldset>
        <legend className="mb-3 text-sm font-semibold text-slate-800">Datos personales</legend>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Nombre" name="first_name" required><Input name="first_name" defaultValue={v("first_name")} required /></Field>
          <Field label="Apellido" name="last_name" required><Input name="last_name" defaultValue={v("last_name")} required /></Field>
          <Field label="Documento de identidad" name="document" required hint="Sin puntos"><Input name="document" defaultValue={v("document")} required /></Field>
          <Field label="Fecha de nacimiento" name="birth_date"><Input name="birth_date" type="date" defaultValue={v("birth_date")} /></Field>
          <Field label="Sexo" name="sex">
            <Select name="sex" defaultValue={v("sex")}>
              <option value="">—</option><option value="F">Femenino</option><option value="M">Masculino</option><option value="X">Otro / no especifica</option>
            </Select>
          </Field>
          <Field label="Teléfono" name="phone"><Input name="phone" defaultValue={v("phone")} /></Field>
          <Field label="Correo electrónico" name="email"><Input name="email" type="email" defaultValue={v("email")} /></Field>
          <Field label="Grupo sanguíneo" name="blood_type">
            <Select name="blood_type" defaultValue={v("blood_type")}>
              <option value="">—</option>{BLOOD_TYPES.map((b) => <option key={b}>{b}</option>)}
            </Select>
          </Field>
          <Field label="Dirección" name="address" className="lg:col-span-2"><Input name="address" defaultValue={v("address")} /></Field>
          <Field label="Ciudad" name="city"><Input name="city" defaultValue={v("city")} /></Field>
          <Field label="País" name="country"><Input name="country" defaultValue={v("country") || "Paraguay"} /></Field>
          <Field label="Contacto de emergencia" name="emergency_contact_name" className="lg:col-span-2"><Input name="emergency_contact_name" defaultValue={v("emergency_contact_name")} /></Field>
          <Field label="Teléfono de emergencia" name="emergency_contact_phone"><Input name="emergency_contact_phone" defaultValue={v("emergency_contact_phone")} /></Field>
        </div>
      </fieldset>
      <fieldset>
        <legend className="mb-3 text-sm font-semibold text-slate-800">Datos clínicos</legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Alergias" name="allergies"><TagInput name="allergies" defaultValue={v("allergies")} suggestions={[...CS.allergies.items]} none={CS.allergies.none} placeholder="Ej.: Penicilina, látex…" /></Field>
          <Field label="Enfermedades preexistentes" name="preexisting_conditions"><TagInput name="preexisting_conditions" defaultValue={v("preexisting_conditions")} suggestions={[...CS.preexisting_conditions.items]} none={CS.preexisting_conditions.none} placeholder="Ej.: Hipertensión, diabetes…" /></Field>
          <Field label="Antecedentes médicos" name="medical_history"><TagInput name="medical_history" defaultValue={v("medical_history")} suggestions={[...CS.medical_history.items]} none={CS.medical_history.none} placeholder="Ej.: Cirugías previas, tabaquismo…" /></Field>
          <Field label="Medicamentos actuales" name="current_medications"><TagInput name="current_medications" defaultValue={v("current_medications")} suggestions={[...CS.current_medications.items]} none={CS.current_medications.none} placeholder="Ej.: Losartán 50 mg…" /></Field>
        </div>
      </fieldset>
      {isNew && (
        <label className="flex items-center gap-2 text-sm text-slate-600">
          <input type="checkbox" name="confirm_duplicate" value="1" className="rounded border-slate-300" /> Confirmo que no es un duplicado
        </label>
      )}
    </div>
  );
}

type Plan = { id: string; name: string; insurer_id: string; insurers: { trade_name: string } | null };

export function InsuranceFields({ plans, i }: { plans: Plan[]; i?: Record<string, string | null> | null }) {
  const v = (k: string) => i?.[k] ?? "";
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Field label="Aseguradora y plan" name="plan_id" required className="sm:col-span-2">
        <Select name="plan_id" defaultValue={v("plan_id")} required>
          <option value="">Seleccioná…</option>
          {plans.map((p) => <option key={p.id} value={p.id}>{p.insurers?.trade_name} — {p.name}</option>)}
        </Select>
      </Field>
      <Field label="Número de afiliado" name="member_number" required><Input name="member_number" defaultValue={v("member_number")} required /></Field>
      <Field label="Número de póliza" name="policy_number"><Input name="policy_number" defaultValue={v("policy_number")} /></Field>
      <Field label="Titular del seguro" name="holder_name"><Input name="holder_name" defaultValue={v("holder_name")} /></Field>
      <Field label="Parentesco con el titular" name="relationship">
        <Select name="relationship" defaultValue={v("relationship") || "Titular"}>
          {["Titular", "Cónyuge", "Hijo/a", "Padre/Madre", "Otro"].map((r) => <option key={r}>{r}</option>)}
        </Select>
      </Field>
      <Field label="Inicio de cobertura" name="start_date" required><Input name="start_date" type="date" defaultValue={v("start_date")} required /></Field>
      <Field label="Vencimiento" name="end_date"><Input name="end_date" type="date" defaultValue={v("end_date")} /></Field>
      <Field label="Estado" name="status">
        <Select name="status" defaultValue={v("status") || "activo"}>
          <option value="activo">Activo</option><option value="suspendido">Suspendido</option><option value="vencido">Vencido</option>
        </Select>
      </Field>
      <Field label="Fotografía de la tarjeta" name="card"><Input name="card" type="file" accept="image/*,application/pdf" /></Field>
      <Field label="Observaciones" name="notes" className="sm:col-span-2"><Textarea name="notes" defaultValue={v("notes")} rows={2} /></Field>
    </div>
  );
}
