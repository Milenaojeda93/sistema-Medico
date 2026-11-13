import Link from "next/link";
import { redirect } from "next/navigation";
import { Building2, Users, UserRound, Activity } from "lucide-react";
import { getSession } from "@/lib/context";
import { Badge, Card, Field, Input, PageHeader, Select, Stat } from "@/components/ui";
import { ActionForm, Modal, SubmitButton } from "@/components/ui/client";
import { Logo } from "@/components/layout/auth-shell";
import { CLINIC_STATUS } from "@/lib/constants";
import { fmtDate, fmtDateTime, gs } from "@/lib/utils";
import { logout } from "@/app/auth/actions";
import { updateClinicAdmin } from "./actions";

export const metadata = { title: "Superadministrador" };

type Row = { id: string; name: string; ruc: string | null; city: string | null; email: string | null; status: string; subscription_plan: string; subscription_ends_at: string | null; created_at: string; users: number; patients: number; doctors: number; last_activity: string | null };

export default async function SuperAdmin() {
  const s = await getSession();
  if (!s.isSuper) redirect("/dashboard");
  const [{ data }, { data: plans }] = await Promise.all([s.supabase.rpc("admin_clinics"), s.supabase.from("subscription_plans").select("*").order("monthly_price")]);
  const rows = (data ?? []) as Row[];
  const mrr = rows.filter((r) => r.status === "activa").reduce((a, r) => a + Number(plans?.find((p) => p.id === r.subscription_plan)?.monthly_price ?? 0), 0);

  return (
    <div className="min-h-screen">
      <header className="flex h-16 items-center justify-between border-b border-slate-200 bg-white px-6">
        <div className="flex items-center gap-3"><Logo /><Badge tone="amber">Superadministrador</Badge></div>
        <div className="flex items-center gap-4 text-sm">
          {s.memberships.length > 0 && <Link href="/dashboard" className="text-primary-600 hover:underline">Ir a mi institución</Link>}
          <form action={logout}><button className="text-slate-500 hover:underline">Cerrar sesión</button></form>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-6 py-8">
        <PageHeader title="Instituciones registradas" description="Gestión de cuentas, planes y suscripciones de la plataforma. Por privacidad, este panel no accede a datos clínicos." />
        <div className="mb-6 grid gap-4 sm:grid-cols-4">
          <Stat label="Instituciones" value={rows.length} icon={<Building2 className="h-5 w-5" />} hint={`${rows.filter((r) => r.status === "activa").length} activas · ${rows.filter((r) => r.status === "prueba").length} en prueba`} />
          <Stat label="Usuarios totales" value={rows.reduce((a, r) => a + Number(r.users), 0)} icon={<Users className="h-5 w-5" />} tone="sky" />
          <Stat label="Profesionales" value={rows.reduce((a, r) => a + Number(r.doctors), 0)} icon={<UserRound className="h-5 w-5" />} tone="violet" />
          <Stat label="Ingreso mensual recurrente" value={gs(mrr)} icon={<Activity className="h-5 w-5" />} tone="green" />
        </div>
        <Card padded={false}>
          <table className="table-base">
            <thead><tr><th>Institución</th><th>Estado</th><th>Plan</th><th>Vence</th><th>Usuarios</th><th>Pacientes</th><th>Médicos</th><th>Alta</th><th>Última actividad</th><th /></tr></thead>
            <tbody>{rows.map((r) => (
              <tr key={r.id}>
                <td><p className="font-medium text-slate-900">{r.name}</p><p className="text-xs text-slate-500">{[r.ruc && `RUC ${r.ruc}`, r.city, r.email].filter(Boolean).join(" · ")}</p></td>
                <td><Badge tone={CLINIC_STATUS[r.status]?.tone}>{CLINIC_STATUS[r.status]?.label}</Badge></td>
                <td>{plans?.find((p) => p.id === r.subscription_plan)?.name ?? r.subscription_plan}</td>
                <td>{fmtDate(r.subscription_ends_at)}</td><td>{r.users}</td><td>{r.patients}</td><td>{r.doctors}</td>
                <td className="text-xs">{fmtDate(r.created_at)}</td><td className="text-xs">{fmtDateTime(r.last_activity)}</td>
                <td className="text-right">
                  <Modal trigger="Gestionar" title={`Cuenta · ${r.name}`} triggerVariant="ghost" triggerSize="sm" size="sm">
                    <ActionForm action={updateClinicAdmin.bind(null, r.id)} className="space-y-4">
                      <Field label="Estado de la cuenta" name="status"><Select name="status" defaultValue={r.status}>{Object.entries(CLINIC_STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</Select></Field>
                      <Field label="Plan contratado" name="plan"><Select name="plan" defaultValue={r.subscription_plan}>{plans?.map((p) => <option key={p.id} value={p.id}>{p.name} · {gs(p.monthly_price)}/mes</option>)}</Select></Field>
                      <Field label="Suscripción vigente hasta" name="ends"><Input name="ends" type="date" defaultValue={r.subscription_ends_at ?? ""} /></Field>
                      <p className="text-xs text-slate-500">Suspender o cancelar bloquea inmediatamente el acceso de todos los usuarios de la institución (también a nivel base de datos).</p>
                      <div className="flex justify-end"><SubmitButton>Guardar</SubmitButton></div>
                    </ActionForm>
                  </Modal>
                </td>
              </tr>
            ))}</tbody>
          </table>
        </Card>
      </main>
    </div>
  );
}
