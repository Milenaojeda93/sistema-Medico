import { guard, can } from "@/lib/context";
import { Card, PageHeader } from "@/components/ui";
import { InvoiceForm } from "../invoice-form";

export const metadata = { title: "Nueva factura" };

export default async function NewInvoice({ searchParams }: { searchParams: Promise<{ paciente?: string; consulta?: string }> }) {
  const ctx = await guard("facturacion", "create");
  const sp = await searchParams;
  const [{ data: patients }, { data: insurances }, { data: services }, cons] = await Promise.all([
    ctx.supabase.from("patients").select("id, first_name, last_name, document").eq("clinic_id", ctx.clinic.id).eq("archived", false).order("last_name").limit(5000),
    ctx.supabase.from("v_patient_insurances").select("id, patient_id, insurer_name, plan_name, member_number, effective_status").eq("clinic_id", ctx.clinic.id),
    ctx.supabase.from("services").select("id, code, name, category, price").eq("clinic_id", ctx.clinic.id).eq("active", true).order("name"),
    sp.consulta ? ctx.supabase.from("consultations").select("appointment_id, appointments(patient_insurance_id)").eq("id", sp.consulta).maybeSingle() : Promise.resolve({ data: null }),
  ]);
  const apptIns = (cons.data?.appointments as unknown as { patient_insurance_id: string | null } | null)?.patient_insurance_id;
  return (
    <>
      <PageHeader title="Nueva factura" description="El sistema calcula automáticamente la parte de la aseguradora y la del paciente según el plan" back={{ href: "/facturacion", label: "Facturación" }} />
      <Card>
        <InvoiceForm
          patients={(patients ?? []).map((p) => ({ id: p.id, name: `${p.last_name}, ${p.first_name} — ${p.document}` }))}
          insurances={insurances ?? []} services={(services ?? []).map((s) => ({ ...s, price: Number(s.price) }))}
          defaultPatient={sp.paciente} consultationId={sp.consulta} appointmentId={cons.data?.appointment_id ?? undefined} defaultInsurance={apptIns ?? undefined}
          canEditPrice={can(ctx.perms, "configuracion", "edit")}
        />
      </Card>
    </>
  );
}
