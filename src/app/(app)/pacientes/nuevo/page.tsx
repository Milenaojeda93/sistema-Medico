import { guard } from "@/lib/context";
import { Card, PageHeader } from "@/components/ui";
import { ActionForm, SubmitButton } from "@/components/ui/client";
import { PatientFields } from "../forms";
import { createPatient } from "../actions";

export const metadata = { title: "Nuevo paciente" };

export default async function NewPatient() {
  await guard("pacientes", "create");
  return (
    <>
      <PageHeader title="Nuevo paciente" back={{ href: "/pacientes", label: "Pacientes" }} />
      <Card>
        <ActionForm action={createPatient}>
          <PatientFields isNew />
          <div className="mt-6 flex justify-end"><SubmitButton>Registrar paciente</SubmitButton></div>
        </ActionForm>
      </Card>
    </>
  );
}
