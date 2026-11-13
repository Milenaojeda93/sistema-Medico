import { guard } from "@/lib/context";
import { Badge, Card, EmptyState, LinkButton, PageHeader } from "@/components/ui";
import { TABLE_LABELS } from "@/lib/constants";
import { fmtDateTime } from "@/lib/utils";

export const metadata = { title: "Auditoría" };

const HIDDEN = new Set(["id", "clinic_id", "created_at", "updated_at"]);
function diff(oldD: Record<string, unknown> | null, newD: Record<string, unknown> | null) {
  const keys = Array.from(new Set([...Object.keys(oldD ?? {}), ...Object.keys(newD ?? {})])).filter((k) => !HIDDEN.has(k));
  return keys.filter((k) => JSON.stringify(oldD?.[k]) !== JSON.stringify(newD?.[k])).map((k) => ({ k, o: oldD?.[k], n: newD?.[k] }));
}
const show = (v: unknown) => (v === null || v === undefined || v === "" ? "∅" : typeof v === "object" ? JSON.stringify(v) : String(v));

export default async function Audit({ searchParams }: { searchParams: Promise<{ tabla?: string; accion?: string; usuario?: string; page?: string }> }) {
  const ctx = await guard("auditoria");
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page ?? 1)), size = 50;
  let q = ctx.supabase.from("audit_log").select("*", { count: "exact" }).eq("clinic_id", ctx.clinic.id).order("created_at", { ascending: false }).range((page - 1) * size, page * size - 1);
  if (sp.tabla) q = q.eq("table_name", sp.tabla);
  if (sp.accion) q = q.eq("action", sp.accion);
  if (sp.usuario) q = q.eq("user_id", sp.usuario);
  const [{ data, count }, { data: people }] = await Promise.all([q, ctx.supabase.from("profiles").select("id, full_name")]);
  const who = (id: string | null) => people?.find((p) => p.id === id)?.full_name ?? "Sistema";
  const pages = Math.ceil((count ?? 0) / size);
  const qs = (p: number) => `?${new URLSearchParams({ ...(sp.tabla ? { tabla: sp.tabla } : {}), ...(sp.accion ? { accion: sp.accion } : {}), ...(sp.usuario ? { usuario: sp.usuario } : {}), page: String(p) })}`;

  return (
    <>
      <PageHeader title="Auditoría" description={`Registro inmutable de altas, modificaciones y eliminaciones · ${count ?? 0} eventos`} />
      <Card padded={false}>
        <form className="flex flex-wrap gap-3 border-b border-slate-100 p-4">
          <select name="tabla" defaultValue={sp.tabla ?? ""} className="input w-auto"><option value="">Todas las entidades</option>{Object.entries(TABLE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
          <select name="accion" defaultValue={sp.accion ?? ""} className="input w-auto"><option value="">Todas las acciones</option><option value="insert">Alta</option><option value="update">Modificación</option><option value="delete">Eliminación</option></select>
          <select name="usuario" defaultValue={sp.usuario ?? ""} className="input w-auto"><option value="">Todos los usuarios</option>{people?.map((p) => <option key={p.id} value={p.id}>{p.full_name}</option>)}</select>
          <button className="rounded-lg bg-slate-800 px-3.5 py-2 text-sm font-medium text-white">Filtrar</button>
        </form>
        {!data?.length ? <EmptyState title="Sin eventos" /> : (
          <table className="table-base">
            <thead><tr><th>Fecha</th><th>Usuario</th><th>Acción</th><th>Entidad</th><th>Detalle</th></tr></thead>
            <tbody>{data.map((e) => {
              const changes = e.action === "update" ? diff(e.old_data, e.new_data) : [];
              return (
                <tr key={e.id} className="align-top">
                  <td className="whitespace-nowrap text-xs">{fmtDateTime(e.created_at, ctx.tz)}</td>
                  <td>{who(e.user_id)}</td>
                  <td><Badge tone={e.action === "insert" ? "green" : e.action === "update" ? "blue" : "red"}>{e.action === "insert" ? "Alta" : e.action === "update" ? "Modificación" : "Eliminación"}</Badge></td>
                  <td>{TABLE_LABELS[e.table_name] ?? e.table_name}<p className="font-mono text-[10px] text-slate-400">{e.record_id}</p></td>
                  <td className="max-w-xl text-xs">
                    {e.action === "update" ? changes.slice(0, 6).map((c) => <p key={c.k}><b className="font-medium">{c.k}</b>: <span className="text-red-600 line-through">{show(c.o).slice(0, 60)}</span> → <span className="text-green-700">{show(c.n).slice(0, 60)}</span></p>)
                      : <details><summary className="cursor-pointer text-primary-600">Ver datos</summary><pre className="mt-1 max-h-48 overflow-auto rounded bg-slate-50 p-2 text-[11px]">{JSON.stringify(e.new_data ?? e.old_data, null, 1)}</pre></details>}
                  </td>
                </tr>
              );
            })}</tbody>
          </table>
        )}
        {pages > 1 && (
          <div className="flex items-center justify-between border-t border-slate-100 px-4 py-3 text-sm text-slate-500">
            <span>Página {page} de {pages}</span>
            <div className="flex gap-2">{page > 1 && <LinkButton variant="secondary" size="sm" href={qs(page - 1)}>Anterior</LinkButton>}{page < pages && <LinkButton variant="secondary" size="sm" href={qs(page + 1)}>Siguiente</LinkButton>}</div>
          </div>
        )}
      </Card>
    </>
  );
}
