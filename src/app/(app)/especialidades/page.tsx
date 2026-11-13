import { guard, can } from "@/lib/context";
import { Badge, Card, Field, Input, PageHeader } from "@/components/ui";
import { ActionButton, ActionForm, SubmitButton } from "@/components/ui/client";
import { createSpecialty, toggleSpecialty } from "./actions";

export const metadata = { title: "Especialidades" };

export default async function Specialties() {
  const ctx = await guard("especialidades");
  const { data } = await ctx.supabase.from("specialties").select("id, name, description, active, doctor_specialties(doctor_id)").eq("clinic_id", ctx.clinic.id).order("name");
  return (
    <>
      <PageHeader title="Especialidades" description="Especialidades médicas que ofrece la institución" />
      <div className="grid gap-6 lg:grid-cols-3">
        <Card padded={false} className="lg:col-span-2">
          <table className="table-base">
            <thead><tr><th>Especialidad</th><th>Descripción</th><th>Profesionales</th><th>Estado</th><th></th></tr></thead>
            <tbody>
              {data?.map((s) => (
                <tr key={s.id}>
                  <td className="font-medium">{s.name}</td><td className="text-slate-500">{s.description ?? "—"}</td>
                  <td>{(s.doctor_specialties as unknown[]).length}</td>
                  <td>{s.active ? <Badge tone="green">Activa</Badge> : <Badge>Inactiva</Badge>}</td>
                  <td className="text-right">{can(ctx.perms, "especialidades", "edit") && <ActionButton action={toggleSpecialty.bind(null, s.id, !s.active)} variant="ghost">{s.active ? "Desactivar" : "Activar"}</ActionButton>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
        {can(ctx.perms, "especialidades", "create") && (
          <Card title="Nueva especialidad">
            <ActionForm action={createSpecialty} resetOnSuccess successMessage="Especialidad creada" className="space-y-4">
              <Field label="Nombre" name="name" required><Input name="name" required /></Field>
              <Field label="Descripción" name="description"><Input name="description" /></Field>
              <div className="flex justify-end"><SubmitButton>Agregar</SubmitButton></div>
            </ActionForm>
          </Card>
        )}
      </div>
    </>
  );
}
