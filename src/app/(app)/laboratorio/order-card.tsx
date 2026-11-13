import Link from "next/link";
import { FileText, Paperclip, Printer } from "lucide-react";
import { StatusBadge, Badge } from "@/components/ui";
import { fmtDateTime } from "@/lib/utils";
import type { Ctx } from "@/lib/context";
import { LAB_STATUS } from "./constants";

export type LabOrderRow = {
  id: string; number: string; ordered_at: string; status: string; priority: string; clinical_notes: string | null;
  doctors?: { full_name: string } | null;
  lab_order_items: { id: string; position: number; study: string; status: string; result: string | null; result_file_path: string | null; result_file_name: string | null; result_at: string | null }[];
};

export const LAB_SELECT = "id, number, ordered_at, status, priority, clinical_notes, doctors(full_name), lab_order_items(id, position, study, status, result, result_file_path, result_file_name, result_at)";

export async function signedUrls(ctx: Ctx, orders: LabOrderRow[]) {
  const paths = orders.flatMap((o) => o.lab_order_items.map((i) => i.result_file_path)).filter(Boolean) as string[];
  if (!paths.length) return {} as Record<string, string>;
  const { data } = await ctx.supabase.storage.from("documentos").createSignedUrls(paths, 600);
  return Object.fromEntries((data ?? []).filter((d) => d.signedUrl).map((d) => [d.path, d.signedUrl])) as Record<string, string>;
}

export function LabOrderCard({ o, tz, urls, showDoctor = false }: { o: LabOrderRow; tz: string; urls: Record<string, string>; showDoctor?: boolean }) {
  const items = [...o.lab_order_items].sort((a, b) => a.position - b.position);
  const done = items.filter((i) => i.status === "completado").length;
  return (
    <div className={`rounded-2xl border p-4 ${o.status === "anulado" ? "border-slate-200 bg-slate-50 opacity-70" : o.status === "completado" ? "border-emerald-200/70 bg-emerald-50/30" : "border-slate-200 bg-white"}`}>
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <Link href={`/laboratorio/${o.id}`} className="font-semibold text-slate-900 hover:text-primary-700">{o.number}</Link>
        <span className="text-xs text-slate-500">{fmtDateTime(o.ordered_at, tz)}{showDoctor && o.doctors ? ` · ${o.doctors.full_name}` : ""}</span>
        <StatusBadge map={LAB_STATUS} value={o.status} />
        {o.priority === "urgente" && <Badge tone="red">Urgente</Badge>}
        <span className="ml-auto text-xs text-slate-500">{done}/{items.length} con resultado</span>
        {o.status !== "anulado" && (
          <Link href={`/laboratorio/${o.id}?imprimir=1`} target="_blank" className="inline-flex items-center gap-1 text-xs font-medium text-slate-600 hover:text-primary-700"><Printer className="h-3.5 w-3.5" /> Orden</Link>
        )}
      </div>
      <ul className="divide-y divide-slate-100 text-sm">
        {items.map((i) => (
          <li key={i.id} className="flex flex-wrap items-start gap-x-3 gap-y-1 py-2">
            <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${i.status === "completado" ? "bg-emerald-500" : "bg-amber-400"}`} />
            <span className="min-w-40 font-medium text-slate-800">{i.study}</span>
            <span className="min-w-0 flex-1 whitespace-pre-line text-slate-600">
              {i.status === "completado" ? (i.result ?? (i.result_file_path ? "Ver archivo adjunto" : "—")) : <span className="text-slate-400">Pendiente</span>}
            </span>
            {i.result_file_path && urls[i.result_file_path] && (
              <a href={urls[i.result_file_path]} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs font-medium text-primary-700 hover:underline">
                {i.result_file_name?.toLowerCase().endsWith(".pdf") ? <FileText className="h-3.5 w-3.5" /> : <Paperclip className="h-3.5 w-3.5" />} {i.result_file_name ?? "Archivo"}
              </a>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
