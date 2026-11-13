import { Plus } from "lucide-react";
import { guard, can } from "@/lib/context";
import { Badge, Card, Field, Input, PageHeader, Select, Tabs } from "@/components/ui";
import { ActionForm, Modal, SubmitButton } from "@/components/ui/client";
import { CATEGORIES, CLINIC_STATUS } from "@/lib/constants";
import { fmtDate, gs } from "@/lib/utils";
import { saveRoom, saveService, updateClinic } from "./actions";

export const metadata = { title: "Configuración" };

type Svc = { id: string; code: string | null; name: string; category: string; specialty_id: string | null; price: number; active: boolean; specialties: { name: string } | null };

function ServiceFields({ s, specialties }: { s?: Svc; specialties: { id: string; name: string }[] }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Field label="Código" name="code"><Input name="code" defaultValue={s?.code ?? ""} /></Field>
      <Field label="Nombre" name="name" required><Input name="name" defaultValue={s?.name} required /></Field>
      <Field label="Categoría" name="category"><Select name="category" defaultValue={s?.category ?? "consulta"}>{Object.entries(CATEGORIES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</Select></Field>
      <Field label="Especialidad" name="specialty_id"><Select name="specialty_id" defaultValue={s?.specialty_id ?? ""}><option value="">—</option>{specialties.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</Select></Field>
      <Field label="Precio (Gs.)" name="price" required><Input name="price" type="number" min={0} defaultValue={s ? Number(s.price) : ""} required /></Field>
      {s && <label className="flex items-center gap-2 self-end pb-2 text-sm"><input type="checkbox" name="active" defaultChecked={s.active} className="rounded border-slate-300" /> Activo</label>}
    </div>
  );
}

export default async function Settings({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const ctx = await guard("configuracion");
  const { tab = "institucion" } = await searchParams;
  const editable = can(ctx.perms, "configuracion", "edit");
  const [{ data: clinic }, { data: rooms }, { data: services }, { data: specialties }, { data: plan }] = await Promise.all([
    ctx.supabase.from("clinics").select("*").eq("id", ctx.clinic.id).single(),
    ctx.supabase.from("rooms").select("*").eq("clinic_id", ctx.clinic.id).order("name"),
    ctx.supabase.from("services").select("*, specialties(name)").eq("clinic_id", ctx.clinic.id).order("category").order("name"),
    ctx.supabase.from("specialties").select("id, name").eq("clinic_id", ctx.clinic.id).order("name"),
    ctx.supabase.from("subscription_plans").select("*"),
  ]);
  const sub = plan?.find((p) => p.id === clinic?.subscription_plan);

  return (
    <>
      <PageHeader title="Configuración" description="Datos de la institución, consultorios y tarifario de servicios" />
      <Tabs active={tab} tabs={[
        { key: "institucion", label: "Institución", href: "/configuracion" },
        { key: "consultorios", label: "Consultorios", href: "/configuracion?tab=consultorios" },
        { key: "servicios", label: "Servicios y tarifas", href: "/configuracion?tab=servicios" },
      ]} />
      {tab === "institucion" && clinic && (
        <div className="grid gap-6 xl:grid-cols-3">
          <Card title="Datos de la institución" className="xl:col-span-2">
            <ActionForm action={updateClinic}>
              <fieldset disabled={!editable} className="grid gap-4 sm:grid-cols-2">
                <Field label="Nombre comercial" name="name" required><Input name="name" defaultValue={clinic.name} required /></Field>
                <Field label="Razón social" name="legal_name"><Input name="legal_name" defaultValue={clinic.legal_name ?? ""} /></Field>
                <Field label="RUC" name="ruc"><Input name="ruc" defaultValue={clinic.ruc ?? ""} /></Field>
                <Field label="Teléfono" name="phone"><Input name="phone" defaultValue={clinic.phone ?? ""} /></Field>
                <Field label="Correo" name="email"><Input name="email" type="email" defaultValue={clinic.email ?? ""} /></Field>
                <Field label="Ciudad" name="city"><Input name="city" defaultValue={clinic.city ?? ""} /></Field>
                <Field label="Dirección" name="address"><Input name="address" defaultValue={clinic.address ?? ""} /></Field>
                <Field label="País" name="country"><Input name="country" defaultValue={clinic.country ?? ""} /></Field>
                <label className="flex items-start gap-3 rounded-xl border border-slate-200 p-4 text-sm sm:col-span-2">
                  <input type="checkbox" name="doctors_see_own_only" defaultChecked={clinic.doctors_see_own_only !== false} className="mt-0.5 h-4 w-4 rounded border-slate-300" />
                  <span><b className="text-slate-900">Cada médico ve solo sus propios pacientes</b><br />
                    <span className="text-slate-500">Al ingresar con su usuario, el médico ve únicamente su agenda, sus consultas, sus recetas y estudios, y los pacientes que atendió o tiene agendados. Administración, recepción y el resto del personal siguen viendo todo.</span></span>
                </label>
              </fieldset>
              {editable && <div className="mt-5 flex justify-end"><SubmitButton>Guardar</SubmitButton></div>}
            </ActionForm>
          </Card>
          <Card title="Suscripción">
            <dl className="space-y-3 text-sm">
              <div className="flex justify-between"><dt className="text-slate-500">Estado</dt><dd><Badge tone={CLINIC_STATUS[clinic.status]?.tone}>{CLINIC_STATUS[clinic.status]?.label}</Badge></dd></div>
              <div className="flex justify-between"><dt className="text-slate-500">Plan</dt><dd className="font-medium">{sub?.name ?? clinic.subscription_plan}</dd></div>
              <div className="flex justify-between"><dt className="text-slate-500">Precio mensual</dt><dd>{sub ? gs(sub.monthly_price) : "—"}</dd></div>
              <div className="flex justify-between"><dt className="text-slate-500">Vigente hasta</dt><dd>{fmtDate(clinic.subscription_ends_at)}</dd></div>
              <div className="flex justify-between"><dt className="text-slate-500">Alta</dt><dd>{fmtDate(clinic.created_at, ctx.tz)}</dd></div>
              <div className="flex justify-between"><dt className="text-slate-500">Zona horaria</dt><dd>{clinic.timezone}</dd></div>
            </dl>
          </Card>
        </div>
      )}
      {tab === "consultorios" && (
        <Card padded={false} actions={editable && (
          <Modal trigger={<><Plus className="h-4 w-4" /> Nuevo consultorio</>} title="Nuevo consultorio" triggerSize="sm" size="sm">
            <ActionForm action={saveRoom.bind(null, null)} className="space-y-4">
              <Field label="Nombre" name="name" required><Input name="name" required /></Field>
              <Field label="Ubicación" name="location"><Input name="location" placeholder="Ej.: Planta baja" /></Field>
              <div className="flex justify-end"><SubmitButton>Crear</SubmitButton></div>
            </ActionForm>
          </Modal>
        )} title="Consultorios">
          <table className="table-base">
            <thead><tr><th>Consultorio</th><th>Ubicación</th><th>Estado</th><th /></tr></thead>
            <tbody>{rooms?.map((r) => (
              <tr key={r.id}><td className="font-medium">{r.name}</td><td>{r.location ?? "—"}</td><td>{r.active ? <Badge tone="green">Activo</Badge> : <Badge>Inactivo</Badge>}</td>
                <td className="text-right">{editable && (
                  <Modal trigger="Editar" title="Editar consultorio" triggerVariant="ghost" triggerSize="sm" size="sm">
                    <ActionForm action={saveRoom.bind(null, r.id)} className="space-y-4">
                      <Field label="Nombre" name="name" required><Input name="name" defaultValue={r.name} required /></Field>
                      <Field label="Ubicación" name="location"><Input name="location" defaultValue={r.location ?? ""} /></Field>
                      <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="active" defaultChecked={r.active} className="rounded border-slate-300" /> Activo</label>
                      <div className="flex justify-end"><SubmitButton>Guardar</SubmitButton></div>
                    </ActionForm>
                  </Modal>
                )}</td></tr>
            ))}</tbody>
          </table>
        </Card>
      )}
      {tab === "servicios" && (
        <Card padded={false} title="Servicios médicos y tarifas" actions={editable && (
          <Modal trigger={<><Plus className="h-4 w-4" /> Nuevo servicio</>} title="Nuevo servicio" triggerSize="sm">
            <ActionForm action={saveService.bind(null, null)}><ServiceFields specialties={specialties ?? []} /><div className="mt-5 flex justify-end"><SubmitButton>Crear</SubmitButton></div></ActionForm>
          </Modal>
        )}>
          <table className="table-base">
            <thead><tr><th>Código</th><th>Servicio</th><th>Categoría</th><th>Especialidad</th><th className="text-right">Precio</th><th>Estado</th><th /></tr></thead>
            <tbody>{((services ?? []) as unknown as Svc[]).map((s) => (
              <tr key={s.id}><td className="text-slate-500">{s.code ?? "—"}</td><td className="font-medium">{s.name}</td><td>{CATEGORIES[s.category]}</td><td>{s.specialties?.name ?? "—"}</td>
                <td className="text-right tabular-nums">{gs(s.price)}</td><td>{s.active ? <Badge tone="green">Activo</Badge> : <Badge>Inactivo</Badge>}</td>
                <td className="text-right">{editable && (
                  <Modal trigger="Editar" title="Editar servicio" triggerVariant="ghost" triggerSize="sm">
                    <ActionForm action={saveService.bind(null, s.id)}><ServiceFields s={s} specialties={specialties ?? []} /><div className="mt-5 flex justify-end"><SubmitButton>Guardar</SubmitButton></div></ActionForm>
                  </Modal>
                )}</td></tr>
            ))}</tbody>
          </table>
        </Card>
      )}
    </>
  );
}
