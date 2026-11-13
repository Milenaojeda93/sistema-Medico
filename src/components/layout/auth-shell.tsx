import type { ReactNode } from "react";
import { HeartPulse, ShieldCheck, CalendarCheck, Receipt, Lock } from "lucide-react";

export function Logo({ light = false }: { light?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <div className="relative flex h-8 w-8 items-center justify-center rounded-[10px] bg-gradient-to-br from-sky-400 via-primary-500 to-primary-700 text-white shadow-[inset_0_1px_0_rgb(255_255_255/0.3),0_4px_12px_-2px_rgb(37_99_235/0.55)]">
        <HeartPulse className="h-[18px] w-[18px]" strokeWidth={2.25} />
      </div>
      <span className={light ? "text-[17px] font-semibold tracking-tight text-white" : "text-[17px] font-semibold tracking-tight text-slate-950"}>
        Med<span className={light ? "text-sky-300" : "text-primary-600"}>via</span>
      </span>
    </div>
  );
}

const FEATURES = [
  { icon: CalendarCheck, title: "Agenda inteligente", text: "Sin superposiciones por profesional ni consultorio." },
  { icon: ShieldCheck, title: "Seguros y coberturas", text: "Cálculo automático de lo que paga la aseguradora y el paciente." },
  { icon: Receipt, title: "Facturación y liquidaciones", text: "Cobros particulares y rendiciones a aseguradoras." },
];

export function AuthShell({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  return (
    <div className="grid min-h-screen lg:grid-cols-[1.05fr_1fr]">
      <aside className="dot-grid relative hidden overflow-hidden bg-ink-950 p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <div className="pointer-events-none absolute -left-40 -top-40 h-[520px] w-[520px] rounded-full bg-primary-600/30 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-48 right-[-120px] h-[460px] w-[460px] rounded-full bg-sky-500/20 blur-3xl" />
        <div className="relative"><Logo light /></div>
        <div className="relative max-w-lg">
          <span className="inline-flex items-center gap-2 rounded-full bg-white/[0.06] px-3 py-1 text-xs font-medium text-sky-200 ring-1 ring-inset ring-white/10">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" /> Plataforma para clínicas y consultorios
          </span>
          <h2 className="mt-5 text-[40px] font-semibold leading-[1.1] tracking-tight">
            Toda tu clínica,{" "}
            <span className="bg-gradient-to-r from-sky-300 to-primary-300 bg-clip-text text-transparent">en un solo lugar.</span>
          </h2>
          <p className="mt-4 text-[15px] leading-relaxed text-slate-400">
            Pacientes, agenda, historias clínicas, seguros y facturación conectados, con los datos de cada institución completamente aislados.
          </p>
          <ul className="mt-10 grid gap-3">
            {FEATURES.map((f) => (
              <li key={f.title} className="flex items-start gap-3.5 rounded-2xl bg-white/[0.04] p-4 ring-1 ring-inset ring-white/[0.08] backdrop-blur">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary-500/15 text-sky-300 ring-1 ring-inset ring-primary-400/20">
                  <f.icon className="h-[18px] w-[18px]" />
                </span>
                <span>
                  <span className="block text-sm font-semibold text-white">{f.title}</span>
                  <span className="mt-0.5 block text-[13px] text-slate-400">{f.text}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
        <p className="relative text-xs text-slate-500">© {new Date().getFullYear()} Medvia</p>
      </aside>
      <main className="flex items-center justify-center bg-white px-6 py-12">
        <div className="w-full max-w-[380px]">
          <div className="mb-10 lg:hidden"><Logo /></div>
          <h1 className="text-[28px] font-semibold tracking-tight text-slate-950">{title}</h1>
          {subtitle && <p className="mt-2 text-sm text-slate-500">{subtitle}</p>}
          <div className="mt-8">{children}</div>
          <p className="mt-10 flex items-center gap-1.5 text-xs text-slate-400">
            <Lock className="h-3.5 w-3.5" /> Conexión segura · Acceso según rol y permisos
          </p>
        </div>
      </main>
    </div>
  );
}
