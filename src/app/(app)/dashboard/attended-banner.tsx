import Link from "next/link";
import { CheckCircle2 } from "lucide-react";
import type { Ctx } from "@/lib/context";

/** Confirmación después de "Finalizar atención". */
export async function AttendedBanner({ ctx, consultationId }: { ctx: Ctx; consultationId?: string }) {
  if (!consultationId || !/^[0-9a-f-]{36}$/.test(consultationId)) return null;
  const { data: c } = await ctx.supabase.from("consultations").select("id, patients(first_name, last_name)").eq("id", consultationId).eq("clinic_id", ctx.clinic.id).maybeSingle();
  const pt = c?.patients as unknown as { first_name: string; last_name: string } | null;
  if (!c || !pt) return null;
  return (
    <div className="mb-5 flex flex-wrap items-center gap-3 rounded-2xl bg-green-50 px-5 py-4 ring-1 ring-green-200">
      <CheckCircle2 className="h-6 w-6 shrink-0 text-green-600" />
      <p className="flex-1 text-sm text-green-900"><b>{pt.first_name} {pt.last_name}</b> quedó como atendido. La consulta está guardada en su historia clínica.</p>
      <Link href={`/consultas/${c.id}`} className="text-sm font-medium text-green-800 underline hover:text-green-900">Ver o imprimir la consulta</Link>
    </div>
  );
}
