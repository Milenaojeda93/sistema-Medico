import Link from "next/link";
import { Plus } from "lucide-react";
import { guard, can } from "@/lib/context";
import { Badge, Card, EmptyState, PageHeader } from "@/components/ui";
import { ActionForm, Modal, SubmitButton } from "@/components/ui/client";
import { InsurerFields } from "./fields";
import { createInsurer } from "./actions";

export const metadata = { title: "Aseguradoras" };

export default async function Insurers() {
  const ctx = await guard("aseguradoras");
  const { data } = await ctx.supabase.from("insurers").select("id, trade_name, legal_name, ruc, phone, email, admin_contact, active, insurance_plans(id), patient_insurances(id)").eq("clinic_id", ctx.clinic.id).order("trade_name");
  return (
    <>
      <PageHeader title="Aseguradoras" description="Compañías de seguros y medicina prepaga con convenio"
        actions={can(ctx.perms, "aseguradoras", "create") && (
          <Modal trigger={<><Plus className="h-4 w-4" /> Nueva aseguradora</>} title="Nueva aseguradora">
            <ActionForm action={createInsurer}><InsurerFields /><div className="mt-5 flex justify-end"><SubmitButton>Crear</SubmitButton></div></ActionForm>
          </Modal>
        )} />
      <Card padded={false}>
        {!data?.length ? <EmptyState title="Sin aseguradoras" description="Registrá las aseguradoras con las que trabaja la institución." /> : (
          <table className="table-base">
            <thead><tr><th>Aseguradora</th><th>RUC</th><th>Contacto</th><th>Planes</th><th>Afiliados</th><th>Estado</th></tr></thead>
            <tbody>{data.map((i) => (
              <tr key={i.id}>
                <td><Link href={`/aseguradoras/${i.id}`} className="font-medium hover:text-primary-700">{i.trade_name}</Link><p className="text-xs text-slate-500">{i.legal_name}</p></td>
                <td>{i.ruc ?? "—"}</td><td className="text-xs">{i.admin_contact}<br />{i.phone} · {i.email}</td>
                <td>{(i.insurance_plans as unknown[]).length}</td><td>{(i.patient_insurances as unknown[]).length}</td>
                <td>{i.active ? <Badge tone="green">Activa</Badge> : <Badge>Inactiva</Badge>}</td>
              </tr>))}</tbody>
          </table>
        )}
      </Card>
    </>
  );
}
