import { getCtx, can } from "@/lib/context";
import { attentionReport, billingReport, diagnosisReport, parseFilters, toCSV } from "../data";

export async function GET(req: Request) {
  const ctx = await getCtx();
  if (!can(ctx.perms, "reportes")) return new Response("Sin permiso", { status: 403 });
  const sp = Object.fromEntries(new URL(req.url).searchParams);
  const f = parseFilters(sp, ctx.tz);
  const tipo = sp.tipo ?? "atenciones";
  const header = `${ctx.clinic.name} · Reporte de ${tipo} · ${f.desde} a ${f.hasta}`;
  let csv: string;
  if (tipo === "diagnosticos") csv = toCSV([(await diagnosisReport(ctx, f)).table], header);
  else if (tipo === "facturacion") csv = toCSV((await billingReport(ctx, f)).tables, header);
  else csv = toCSV((await attentionReport(ctx, f)).tables, header);
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="medvia-${tipo}-${f.desde}-a-${f.hasta}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
