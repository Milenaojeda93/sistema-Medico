import { redirect } from "next/navigation";
import { getCtx, can } from "@/lib/context";
import { MODULES } from "@/lib/constants";
import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const ctx = await getCtx();
  if (!["prueba", "activa"].includes(ctx.clinic.status)) redirect("/cuenta-suspendida");
  const allowed = MODULES.filter((m) => can(ctx.perms, m.key)).map((m) => m.key);
  return (
    <div className="min-h-screen">
      <Sidebar allowed={allowed} isSuper={ctx.isSuper} clinicName={ctx.clinic.name} />
      <div className="app-shell transition-[padding] duration-200 print:pl-0">
        <Topbar ctx={ctx} />
        <main className="mx-auto max-w-[1440px] px-4 py-7 lg:px-10 lg:py-9">{children}</main>
      </div>
    </div>
  );
}
