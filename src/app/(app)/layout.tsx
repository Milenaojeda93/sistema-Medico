import { redirect } from "next/navigation";
import { getCtx, can } from "@/lib/context";
import { addDays, todayISO, zonedToUtc } from "@/lib/utils";
import { MODULES } from "@/lib/constants";
import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const ctx = await getCtx();
  if (!["prueba", "activa"].includes(ctx.clinic.status)) redirect("/cuenta-suspendida");
  const allowed = MODULES.filter((m) => can(ctx.perms, m.key)).map((m) => m.key);
  // Médicos: cuántos pacientes les quedan hoy (contador de "Mis citas").
  let myAppointments: number | null = null;
  if (ctx.myDoctorIds.length && can(ctx.perms, "agenda")) {
    const today = todayISO(ctx.tz);
    const { count } = await ctx.supabase.from("appointments").select("id", { count: "exact", head: true })
      .eq("clinic_id", ctx.clinic.id).in("doctor_id", ctx.myDoctorIds)
      .gte("starts_at", zonedToUtc(`${today}T00:00`, ctx.tz).toISOString()).lt("starts_at", zonedToUtc(`${addDays(today, 1)}T00:00`, ctx.tz).toISOString())
      .in("status", ["pendiente", "confirmada", "en_espera", "en_atencion"]);
    myAppointments = count ?? 0;
  }
  return (
    <div className="min-h-screen">
      <Sidebar allowed={allowed} isSuper={ctx.isSuper} clinicName={ctx.clinic.name} myAppointments={myAppointments} />
      <div className="app-shell transition-[padding] duration-200 print:pl-0">
        <Topbar ctx={ctx} />
        <main className="mx-auto max-w-[1440px] px-4 py-7 lg:px-10 lg:py-9">{children}</main>
      </div>
    </div>
  );
}
