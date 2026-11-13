import { notFound } from "next/navigation";
import { guard } from "@/lib/context";
import { Card, PageHeader } from "@/components/ui";
import { ActionForm, SubmitButton } from "@/components/ui/client";
import { PatientFields } from "../../forms";
import { updatePatient } from "../../actions";

export default async function EditPatient({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await guard("pacientes", "edit");
  const { data: p } = await ctx.supabase.from("patients").select("*").eq("id", id).eq("clinic_id", ctx.clinic.id).maybeSingle();
  if (!p) notFound();
  return (
    <>
      <PageHeader title={`Editar: ${p.first_name} ${p.last_name}`} back={{ href: `/pacientes/${id}`, label: "Volver al perfil" }} />
      <Card>
        <ActionForm action={updatePatient.bind(null, id)}>
          <PatientFields p={p} />
          <div className="mt-6 flex justify-end"><SubmitButton>Guardar cambios</SubmitButton></div>
        </ActionForm>
      </Card>
    </>
  );
}
