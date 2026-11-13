import Link from "next/link";
import { realAllergies } from "@/lib/constants";
import { notFound } from "next/navigation";
import { Pencil, Plus, Archive, ArchiveRestore, FileText, AlertTriangle, CalendarPlus, Receipt } from "lucide-react";
import { guard, can } from "@/lib/context";
import { Badge, Card, DL, EmptyState, LinkButton, PageHeader, StatusBadge, Tabs, Field, Input, Select } from "@/components/ui";
import { ActionButton, ActionForm, Modal, SubmitButton } from "@/components/ui/client";
import { ACTION_LABELS, APPOINTMENT_STATUS, AUTH_STATUS, INSURANCE_STATUS, INVOICE_STATUS, TABLE_LABELS } from "@/lib/constants";
import { age, fmtDate, fmtDateTime, gs } from "@/lib/utils";
import { InsuranceFields } from "../forms";
import { saveInsurance, toggleArchive, uploadDocument } from "../actions";
import { LAB_SELECT, LabOrderCard, signedUrls, type LabOrderRow } from "../../laboratorio/order-card";

export default async function PatientProfile({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ tab?: string }> }) {
  const { id } = await params;
  const { tab = "info" } = await searchParams;
  const ctx = await guard("pacientes");
  const { supabase, perms, tz } = ctx;
  const { data: p } = await supabase.from("patients").select("*").eq("id", id).eq("clinic_id", ctx.clinic.id).maybeSingle();
  if (!p) notFound();

  const canClinical = can(perms, "historias");
  const canBilling = can(perms, "facturacion");
  const tabs = [
    { key: "info", label: "Información personal" },
    { key: "seguros", label: "Seguros médicos", hidden: !can(perms, "seguros") },
    { key: "historia", label: "Historia clínica", hidden: !canClinical },
    { key: "consultas", label: "Consultas y citas", hidden: !can(perms, "agenda") },
    { key: "diagnosticos", label: "Diagnósticos", hidden: !canClinical },
    { key: "recetas", label: "Recetas", hidden: !can(perms, "recetas") },
    { key: "estudios", label: "Estudios", hidden: !can(perms, "laboratorio") },
    { key: "documentos", label: "Documentos" },
    { key: "pagos", label: "Pagos", hidden: !canBilling },
    { key: "actividad", label: "Historial de actividad", hidden: !can(perms, "auditoria") },
  ].filter((t) => !t.hidden).map((t) => ({ ...t, href: `/pacientes/${id}?tab=${t.key}` }));

  const years = age(p.birth_date);

  return (
    <>
      <PageHeader
        back={{ href: "/pacientes", label: "Pacientes" }}
        title={<span className="flex items-center gap-3">{p.first_name} {p.last_name} {p.archived && <Badge>Archivado</Badge>}</span>}
        description={`CI ${p.document}${years !== null ? ` · ${years} años` : ""}${p.blood_type ? ` · Grupo ${p.blood_type}` : ""}${p.phone ? ` · ${p.phone}` : ""}`}
        actions={
          <>
            {can(perms, "agenda", "create") && <LinkButton variant="secondary" href={`/agenda?nueva=1&paciente=${id}`}><CalendarPlus className="h-4 w-4" /> Agendar cita</LinkButton>}
            {can(perms, "facturacion", "create") && <LinkButton variant="secondary" href={`/facturacion/nueva?paciente=${id}`}><Receipt className="h-4 w-4" /> Facturar</LinkButton>}
            {can(perms, "pacientes", "edit") && <LinkButton href={`/pacientes/${id}/editar`}><Pencil className="h-4 w-4" /> Editar</LinkButton>}
          </>
        }
      />
      {realAllergies(p.allergies) && (
        <div className="mb-4 flex items-center gap-2 rounded-lg bg-red-50 px-4 py-2.5 text-sm text-red-800 ring-1 ring-red-100">
          <AlertTriangle className="h-4 w-4" /> <b>Alergias:</b> {p.allergies}
        </div>
      )}
      <Tabs tabs={tabs} active={tab} />

      {tab === "info" && (
        <div className="grid gap-6 xl:grid-cols-3">
          <Card title="Datos personales" className="xl:col-span-2">
            <DL items={[
              ["Nombre completo", `${p.first_name} ${p.last_name}`], ["Documento", p.document], ["Fecha de nacimiento", fmtDate(p.birth_date)],
              ["Edad", years !== null ? `${years} años` : null], ["Sexo", { F: "Femenino", M: "Masculino", X: "Otro" }[p.sex as string] ?? null], ["Grupo sanguíneo", p.blood_type],
              ["Teléfono", p.phone], ["Correo", p.email], ["Dirección", p.address], ["Ciudad", p.city], ["País", p.country],
              ["Contacto de emergencia", p.emergency_contact_name ? `${p.emergency_contact_name}${p.emergency_contact_phone ? " · " + p.emergency_contact_phone : ""}` : null],
            ]} />
          </Card>
          <Card title="Resumen clínico">
            <DL cols={2} items={[["Alergias", p.allergies], ["Enfermedades preexistentes", p.preexisting_conditions], ["Antecedentes", p.medical_history], ["Medicamentos actuales", p.current_medications]]} />
          </Card>
          <div className="xl:col-span-3 flex justify-between text-xs text-slate-400">
            <span>Registrado el {fmtDateTime(p.created_at, tz)} · Última modificación {fmtDateTime(p.updated_at, tz)}</span>
            {can(perms, "pacientes", "edit") && (
              <ActionButton action={toggleArchive.bind(null, id, !p.archived)} confirm={p.archived ? undefined : "¿Archivar este paciente? Sus datos se conservan."}>
                {p.archived ? <><ArchiveRestore className="h-3.5 w-3.5" /> Reactivar</> : <><Archive className="h-3.5 w-3.5" /> Archivar</>}
              </ActionButton>
            )}
          </div>
        </div>
      )}

      {tab === "seguros" && <InsuranceTab patientId={id} ctx={ctx} />}
      {tab === "historia" && canClinical && <ClinicalTab patientId={id} ctx={ctx} />}
      {tab === "consultas" && <AppointmentsTab patientId={id} ctx={ctx} />}
      {tab === "diagnosticos" && canClinical && <DiagnosesTab patientId={id} ctx={ctx} />}
      {tab === "recetas" && can(perms, "recetas") && <PrescriptionsTab patientId={id} ctx={ctx} />}
      {tab === "estudios" && can(perms, "laboratorio") && <StudiesTab patientId={id} ctx={ctx} />}
      {tab === "documentos" && <DocumentsTab patientId={id} ctx={ctx} />}
      {tab === "pagos" && canBilling && <PaymentsTab patientId={id} ctx={ctx} />}
      {tab === "actividad" && <ActivityTab patientId={id} ctx={ctx} />}
    </>
  );
}

type C = Awaited<ReturnType<typeof guard>>;

async function InsuranceTab({ patientId, ctx }: { patientId: string; ctx: C }) {
  const [{ data: ins }, { data: plans }, { data: auths }] = await Promise.all([
    ctx.supabase.from("v_patient_insurances").select("*").eq("patient_id", patientId).order("created_at"),
    ctx.supabase.from("insurance_plans").select("id, name, insurer_id, insurers(trade_name)").eq("clinic_id", ctx.clinic.id).eq("active", true).order("name"),
    can(ctx.perms, "autorizaciones") ? ctx.supabase.from("authorizations").select("id, service_description, request_date, status, authorization_number").eq("patient_id", patientId).order("request_date", { ascending: false }) : Promise.resolve({ data: [] }),
  ]);
  const canEdit = can(ctx.perms, "seguros", "create");
  const planList = (plans ?? []) as unknown as Parameters<typeof InsuranceFields>[0]["plans"];
  const paths = (ins ?? []).map((i) => i.card_path).filter(Boolean) as string[];
  const { data: urls } = paths.length ? await ctx.supabase.storage.from("documentos").createSignedUrls(paths, 600) : { data: [] };
  const urlFor = (p: string | null) => urls?.find((u) => u.path === p)?.signedUrl ?? undefined;

  return (
    <div className="space-y-6">
      <Card title="Seguros médicos del paciente" padded={false}
        actions={canEdit && (
          <Modal trigger={<><Plus className="h-4 w-4" /> Agregar seguro</>} title="Agregar seguro médico" triggerSize="sm">
            <ActionForm action={saveInsurance.bind(null, patientId, null)}>
              <InsuranceFields plans={planList} />
              <div className="mt-5 flex justify-end"><SubmitButton>Guardar seguro</SubmitButton></div>
            </ActionForm>
          </Modal>
        )}>
        {!ins?.length ? <EmptyState title="Sin seguros registrados" description="El paciente se atiende como particular." /> : (
          <div className="grid gap-4 p-5 md:grid-cols-2">
            {ins.map((i) => (
              <div key={i.id} className="rounded-xl border border-slate-200 p-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold text-slate-900">{i.insurer_name}</p>
                    <p className="text-sm text-slate-500">{i.plan_name}</p>
                  </div>
                  <StatusBadge map={INSURANCE_STATUS} value={i.effective_status} />
                </div>
                <dl className="mt-3 grid grid-cols-2 gap-2 text-sm">
                  <div><dt className="text-xs text-slate-500">N° afiliado</dt><dd>{i.member_number}</dd></div>
                  <div><dt className="text-xs text-slate-500">N° póliza</dt><dd>{i.policy_number ?? "—"}</dd></div>
                  <div><dt className="text-xs text-slate-500">Titular</dt><dd>{i.holder_name ?? "—"} ({i.relationship})</dd></div>
                  <div><dt className="text-xs text-slate-500">Vigencia</dt><dd>{fmtDate(i.start_date)} → {i.end_date ? fmtDate(i.end_date) : "sin vencimiento"}</dd></div>
                </dl>
                <div className="mt-3 flex items-center gap-2">
                  {i.card_path && urlFor(i.card_path) && <a href={urlFor(i.card_path)} target="_blank" className="text-xs font-medium text-primary-600 hover:underline">Ver tarjeta</a>}
                  {can(ctx.perms, "seguros", "edit") && (
                    <Modal trigger="Editar" title="Editar seguro" triggerVariant="ghost" triggerSize="sm" triggerClassName="ml-auto">
                      <ActionForm action={saveInsurance.bind(null, patientId, i.id)}>
                        <InsuranceFields plans={planList} i={i} />
                        <div className="mt-5 flex justify-end"><SubmitButton>Guardar cambios</SubmitButton></div>
                      </ActionForm>
                    </Modal>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
      {can(ctx.perms, "autorizaciones") && (
        <Card title="Historial de autorizaciones" padded={false} actions={can(ctx.perms, "autorizaciones", "create") && <LinkButton size="sm" variant="secondary" href={`/autorizaciones?nueva=1&paciente=${patientId}`}>Solicitar autorización</LinkButton>}>
          {!auths?.length ? <p className="p-5 text-sm text-slate-500">Sin autorizaciones.</p> : (
            <table className="table-base"><thead><tr><th>Servicio</th><th>Solicitud</th><th>N° autorización</th><th>Estado</th></tr></thead>
              <tbody>{auths.map((a) => <tr key={a.id}><td>{a.service_description}</td><td>{fmtDate(a.request_date)}</td><td>{a.authorization_number ?? "—"}</td><td><StatusBadge map={AUTH_STATUS} value={a.status} /></td></tr>)}</tbody>
            </table>
          )}
        </Card>
      )}
    </div>
  );
}

async function ClinicalTab({ patientId, ctx }: { patientId: string; ctx: C }) {
  const { data } = await ctx.supabase.from("consultations")
    .select("id, consulted_at, reason, symptoms, diagnosis, diagnosis_code, treatment, status, bp_systolic, bp_diastolic, temperature, heart_rate, oxygen_saturation, weight_kg, doctors(full_name), specialties(name)")
    .eq("patient_id", patientId).order("consulted_at", { ascending: false });
  return (
    <Card title="Historia clínica" padded={false} actions={can(ctx.perms, "historias", "create") && <LinkButton size="sm" href={`/consultas/nueva?paciente=${patientId}`}><Plus className="h-4 w-4" /> Nueva consulta</LinkButton>}>
      {!data?.length ? <EmptyState title="Sin consultas registradas" /> : (
        <ol className="relative space-y-0 p-5">
          {data.map((c) => {
            const doc = c.doctors as unknown as { full_name: string } | null;
            const sp = c.specialties as unknown as { name: string } | null;
            return (
              <li key={c.id} className="relative border-l-2 border-primary-100 pb-6 pl-6 last:pb-0">
                <span className="absolute -left-[7px] top-1 h-3 w-3 rounded-full bg-primary-500 ring-4 ring-white" />
                <div className="flex flex-wrap items-center gap-2">
                  <Link href={`/consultas/${c.id}`} className="font-semibold text-slate-900 hover:text-primary-700">{fmtDateTime(c.consulted_at, ctx.tz)}</Link>
                  <span className="text-sm text-slate-500">{doc?.full_name}{sp ? ` · ${sp.name}` : ""}</span>
                  <Badge tone={c.status === "cerrada" ? "gray" : "amber"}>{c.status === "cerrada" ? "Cerrada" : "Abierta"}</Badge>
                </div>
                <p className="mt-1 text-sm text-slate-700"><b className="font-medium">Motivo:</b> {c.reason}</p>
                {c.diagnosis && <p className="text-sm text-slate-700"><b className="font-medium">Diagnóstico:</b> {c.diagnosis} {c.diagnosis_code && <span className="text-slate-400">({c.diagnosis_code})</span>}</p>}
                {c.treatment && <p className="text-sm text-slate-600"><b className="font-medium">Tratamiento:</b> {c.treatment}</p>}
                <p className="mt-1 text-xs text-slate-500">
                  {c.bp_systolic && `PA ${c.bp_systolic}/${c.bp_diastolic} · `}{c.temperature && `T° ${c.temperature} · `}{c.heart_rate && `FC ${c.heart_rate} · `}{c.oxygen_saturation && `SatO₂ ${c.oxygen_saturation}% · `}{c.weight_kg && `${c.weight_kg} kg`}
                </p>
              </li>
            );
          })}
        </ol>
      )}
    </Card>
  );
}

async function AppointmentsTab({ patientId, ctx }: { patientId: string; ctx: C }) {
  const { data } = await ctx.supabase.from("appointments").select("id, starts_at, status, care_type, reason, doctors(full_name), specialties(name)").eq("patient_id", patientId).order("starts_at", { ascending: false });
  return (
    <Card title="Consultas y citas" padded={false}>
      {!data?.length ? <EmptyState title="Sin citas" /> : (
        <table className="table-base"><thead><tr><th>Fecha</th><th>Profesional</th><th>Especialidad</th><th>Motivo</th><th>Tipo</th><th>Estado</th></tr></thead>
          <tbody>{data.map((a) => (
            <tr key={a.id}>
              <td>{fmtDateTime(a.starts_at, ctx.tz)}</td><td>{(a.doctors as unknown as { full_name: string })?.full_name}</td>
              <td>{(a.specialties as unknown as { name: string } | null)?.name ?? "—"}</td><td>{a.reason ?? "—"}</td>
              <td>{a.care_type === "seguro" ? <Badge tone="blue">Seguro</Badge> : <Badge>Particular</Badge>}</td>
              <td><StatusBadge map={APPOINTMENT_STATUS} value={a.status} /></td>
            </tr>))}</tbody>
        </table>
      )}
    </Card>
  );
}

async function DiagnosesTab({ patientId, ctx }: { patientId: string; ctx: C }) {
  const { data } = await ctx.supabase.from("consultations").select("id, consulted_at, diagnosis, diagnosis_code, doctors(full_name)").eq("patient_id", patientId).not("diagnosis", "is", null).order("consulted_at", { ascending: false });
  return (
    <Card title="Diagnósticos registrados" padded={false}>
      {!data?.length ? <EmptyState title="Sin diagnósticos" /> : (
        <table className="table-base"><thead><tr><th>Fecha</th><th>Diagnóstico</th><th>Código CIE-10</th><th>Profesional</th></tr></thead>
          <tbody>{data.map((c) => <tr key={c.id}><td>{fmtDate(c.consulted_at, ctx.tz)}</td><td><Link className="hover:text-primary-700" href={`/consultas/${c.id}`}>{c.diagnosis}</Link></td><td>{c.diagnosis_code ?? "—"}</td><td>{(c.doctors as unknown as { full_name: string })?.full_name}</td></tr>)}</tbody>
        </table>
      )}
    </Card>
  );
}

async function PrescriptionsTab({ patientId, ctx }: { patientId: string; ctx: C }) {
  const { data } = await ctx.supabase.from("prescriptions").select("id, number, issued_at, status, diagnosis, doctors(full_name), prescription_items(drug, presentation, dose, frequency, duration, position)")
    .eq("clinic_id", ctx.clinic.id).eq("patient_id", patientId).order("issued_at", { ascending: false });
  type I = { drug: string; presentation: string | null; dose: string | null; frequency: string | null; duration: string | null; position: number };
  return (
    <Card title="Recetas emitidas" padded={false}>
      {!data?.length ? <EmptyState title="Sin recetas" description="Las recetas se emiten desde la consulta del paciente." /> : (
        <ul className="divide-y divide-slate-100">
          {data.map((r) => (
            <li key={r.id} className={`px-5 py-4 ${r.status === "anulada" ? "opacity-60" : ""}`}>
              <div className="mb-1 flex flex-wrap items-center gap-2">
                <Link href={`/recetas/${r.id}`} className="font-semibold text-slate-900 hover:text-primary-700">{r.number}</Link>
                <span className="text-xs text-slate-500">{fmtDateTime(r.issued_at, ctx.tz)} · {(r.doctors as unknown as { full_name: string }).full_name}</span>
                {r.status === "anulada" ? <Badge tone="red">Anulada</Badge> : <Badge tone="green">Emitida</Badge>}
                {r.status !== "anulada" && <Link href={`/recetas/${r.id}?imprimir=1`} target="_blank" className="ml-auto text-xs font-medium text-primary-700 hover:underline">Imprimir</Link>}
              </div>
              {r.diagnosis && <p className="text-xs text-slate-500">Diagnóstico: {r.diagnosis}</p>}
              <ul className="mt-1 text-sm text-slate-700">
                {[...(r.prescription_items as I[])].sort((a, b) => a.position - b.position).map((i, n) => (
                  <li key={n}>• <b>{i.drug}</b>{i.presentation ? ` ${i.presentation}` : ""}{[i.dose, i.frequency, i.duration].filter(Boolean).length ? ` — ${[i.dose, i.frequency, i.duration].filter(Boolean).join(", ")}` : ""}</li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

async function StudiesTab({ patientId, ctx }: { patientId: string; ctx: C }) {
  const { data } = await ctx.supabase.from("lab_orders").select(LAB_SELECT).eq("clinic_id", ctx.clinic.id).eq("patient_id", patientId).order("ordered_at", { ascending: false });
  const orders = (data ?? []) as unknown as LabOrderRow[];
  const urls = await signedUrls(ctx, orders);
  return (
    <Card title="Estudios y resultados">
      {!orders.length ? <EmptyState title="Sin estudios" description="Los estudios se piden desde la consulta del paciente." /> : (
        <div className="space-y-3">{orders.map((o) => <LabOrderCard key={o.id} o={o} tz={ctx.tz} urls={urls} showDoctor />)}</div>
      )}
    </Card>
  );
}

async function DocumentsTab({ patientId, ctx }: { patientId: string; ctx: C }) {
  const { data } = await ctx.supabase.from("patient_documents").select("*").eq("patient_id", patientId).order("created_at", { ascending: false });
  const { data: urls } = data?.length ? await ctx.supabase.storage.from("documentos").createSignedUrls(data.map((d) => d.storage_path), 600) : { data: [] };
  return (
    <Card title="Documentos" padded={false} actions={can(ctx.perms, "pacientes", "edit") && (
      <Modal trigger={<><Plus className="h-4 w-4" /> Subir documento</>} title="Subir documento" triggerSize="sm" size="sm">
        <ActionForm action={uploadDocument.bind(null, patientId)} className="space-y-4">
          <Field label="Archivo (PDF o imagen, máx. 10 MB)" name="file" required><Input type="file" name="file" accept="application/pdf,image/*" required /></Field>
          <Field label="Nombre" name="name"><Input name="name" placeholder="Ej.: Orden médica" /></Field>
          <Field label="Categoría" name="category">
            <Select name="category"><option value="general">General</option><option value="estudio">Estudio / resultado</option><option value="seguro">Seguro</option><option value="consentimiento">Consentimiento</option><option value="identidad">Identidad</option></Select>
          </Field>
          <div className="flex justify-end"><SubmitButton>Subir</SubmitButton></div>
        </ActionForm>
      </Modal>
    )}>
      {!data?.length ? <EmptyState title="Sin documentos" /> : (
        <ul className="divide-y divide-slate-100">
          {data.map((d) => (
            <li key={d.id} className="flex items-center gap-3 px-5 py-3">
              <FileText className="h-5 w-5 text-primary-500" />
              <div className="flex-1"><p className="text-sm font-medium text-slate-800">{d.name}</p><p className="text-xs text-slate-500">{d.category} · {fmtDateTime(d.created_at, ctx.tz)} · {Math.round((d.size_bytes ?? 0) / 1024)} KB</p></div>
              {urls?.find((u) => u.path === d.storage_path)?.signedUrl && <a className="text-sm font-medium text-primary-600 hover:underline" target="_blank" href={urls.find((u) => u.path === d.storage_path)!.signedUrl ?? undefined}>Abrir</a>}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

async function PaymentsTab({ patientId, ctx }: { patientId: string; ctx: C }) {
  const { data } = await ctx.supabase.from("invoices").select("id, number, issue_date, care_type, total, insurer_amount, patient_amount, patient_paid, status, insurers(trade_name), payments(id, amount, method, paid_at)").eq("patient_id", patientId).order("issue_date", { ascending: false });
  const balance = (data ?? []).filter((i) => i.status !== "anulada").reduce((a, i) => a + Number(i.patient_amount) - Number(i.patient_paid), 0);
  return (
    <Card title={`Facturas y pagos · saldo pendiente ${gs(balance)}`} padded={false}>
      {!data?.length ? <EmptyState title="Sin facturas" /> : (
        <table className="table-base"><thead><tr><th>Factura</th><th>Fecha</th><th>Tipo</th><th className="text-right">Total</th><th className="text-right">Aseguradora</th><th className="text-right">Paciente</th><th className="text-right">Pagado</th><th>Estado</th></tr></thead>
          <tbody>{data.map((i) => (
            <tr key={i.id}>
              <td><Link href={`/facturacion/${i.id}`} className="font-medium hover:text-primary-700">{i.number}</Link></td><td>{fmtDate(i.issue_date)}</td>
              <td>{i.care_type === "seguro" ? (i.insurers as unknown as { trade_name: string })?.trade_name : "Particular"}</td>
              <td className="text-right tabular-nums">{gs(i.total)}</td><td className="text-right tabular-nums">{gs(i.insurer_amount)}</td>
              <td className="text-right tabular-nums">{gs(i.patient_amount)}</td><td className="text-right tabular-nums">{gs(i.patient_paid)}</td>
              <td><StatusBadge map={INVOICE_STATUS} value={i.status} /></td>
            </tr>))}</tbody>
        </table>
      )}
    </Card>
  );
}

async function ActivityTab({ patientId, ctx }: { patientId: string; ctx: C }) {
  const { data } = await ctx.supabase.from("audit_log").select("id, table_name, action, created_at, user_id")
    .eq("clinic_id", ctx.clinic.id).or(`record_id.eq.${patientId},new_data->>patient_id.eq.${patientId},old_data->>patient_id.eq.${patientId}`)
    .order("created_at", { ascending: false }).limit(100);
  const ids = Array.from(new Set((data ?? []).map((d) => d.user_id).filter(Boolean)));
  const { data: people } = ids.length ? await ctx.supabase.from("profiles").select("id, full_name").in("id", ids) : { data: [] };
  return (
    <Card title="Historial de actividad" padded={false}>
      {!data?.length ? <EmptyState title="Sin actividad" /> : (
        <ul className="divide-y divide-slate-100">
          {data.map((a) => (
            <li key={a.id} className="px-5 py-2.5 text-sm">
              <b className="font-medium">{people?.find((p) => p.id === a.user_id)?.full_name ?? "Sistema"}</b> {ACTION_LABELS[a.action]} {(TABLE_LABELS[a.table_name] ?? a.table_name).toLowerCase()}
              <span className="ml-2 text-xs text-slate-400">{fmtDateTime(a.created_at, ctx.tz)}</span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
