import { guard } from "@/lib/context";
import { Card, PageHeader } from "@/components/ui";
import { ActionForm, SubmitButton } from "@/components/ui/client";
import { DoctorFields } from "../fields";
import { createDoctor } from "../actions";

export default async function NewDoctor() {
  const ctx = await guard("medicos", "create");
  const [{ data: rooms }, { data: specialties }, { data: users }] = await Promise.all([
    ctx.supabase.from("rooms").select("id, name").eq("clinic_id", ctx.clinic.id).eq("active", true).order("name"),
    ctx.supabase.from("specialties").select("id, name").eq("clinic_id", ctx.clinic.id).eq("active", true).order("name"),
    ctx.supabase.rpc("clinic_users", { p_clinic: ctx.clinic.id }),
  ]);
  return (
    <>
      <PageHeader title="Nuevo profesional" back={{ href: "/medicos", label: "Médicos" }} />
      <Card>
        <ActionForm action={createDoctor}>
          <DoctorFields rooms={rooms ?? []} specialties={specialties ?? []} selected={[]} users={users ?? []} />
          <div className="mt-6 flex justify-end"><SubmitButton>Guardar y configurar horarios</SubmitButton></div>
        </ActionForm>
      </Card>
    </>
  );
}
