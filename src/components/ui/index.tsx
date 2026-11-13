import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { Inbox } from "lucide-react";
import { cn } from "@/lib/utils";

const TONES = {
  gray: "bg-slate-50 text-slate-700 ring-slate-200",
  blue: "bg-primary-50 text-primary-700 ring-primary-200/70",
  sky: "bg-sky-50 text-sky-700 ring-sky-200/70",
  green: "bg-emerald-50 text-emerald-700 ring-emerald-200/70",
  amber: "bg-amber-50 text-amber-800 ring-amber-200/70",
  red: "bg-rose-50 text-rose-700 ring-rose-200/70",
  violet: "bg-violet-50 text-violet-700 ring-violet-200/70",
} as const;
const DOTS: Record<Tone, string> = {
  gray: "bg-slate-400", blue: "bg-primary-500", sky: "bg-sky-500", green: "bg-emerald-500", amber: "bg-amber-500", red: "bg-rose-500", violet: "bg-violet-500",
};
export type Tone = keyof typeof TONES;

export function Badge({ tone = "gray", children, className }: { tone?: Tone; children: ReactNode; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset whitespace-nowrap", TONES[tone], className)}>
      <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", DOTS[tone])} />
      {children}
    </span>
  );
}

export function StatusBadge({ map, value }: { map: Record<string, { label: string; tone: Tone }>; value: string | null | undefined }) {
  const s = value ? map[value] : undefined;
  return <Badge tone={s?.tone ?? "gray"}>{s?.label ?? value ?? "—"}</Badge>;
}

const BTN = {
  primary: "bg-gradient-to-b from-primary-500 to-primary-600 text-white shadow-[inset_0_1px_0_rgb(255_255_255/0.18),0_1px_2px_rgb(29_79_215/0.35)] ring-1 ring-inset ring-primary-700/40 hover:from-primary-600 hover:to-primary-700",
  secondary: "bg-white text-slate-700 shadow-soft ring-1 ring-inset ring-slate-200 hover:bg-slate-50 hover:ring-slate-300",
  ghost: "text-slate-600 hover:bg-slate-100 hover:text-slate-900",
  danger: "bg-gradient-to-b from-rose-500 to-rose-600 text-white shadow-[inset_0_1px_0_rgb(255_255_255/0.18),0_1px_2px_rgb(225_29_72/0.3)] ring-1 ring-inset ring-rose-700/40 hover:from-rose-600 hover:to-rose-700",
  success: "bg-gradient-to-b from-emerald-500 to-emerald-600 text-white shadow-[inset_0_1px_0_rgb(255_255_255/0.18),0_1px_2px_rgb(5_150_105/0.3)] ring-1 ring-inset ring-emerald-700/40 hover:from-emerald-600 hover:to-emerald-700",
  soft: "bg-primary-50 text-primary-700 ring-1 ring-inset ring-primary-100 hover:bg-primary-100",
};
export type BtnVariant = keyof typeof BTN;

export function btnClass(variant: BtnVariant = "primary", size: "sm" | "md" = "md") {
  return cn(
    "inline-flex items-center justify-center gap-1.5 rounded-[10px] font-medium transition-all active:translate-y-px disabled:opacity-60 disabled:cursor-not-allowed whitespace-nowrap",
    size === "sm" ? "h-8 px-2.5 text-xs" : "h-9 px-3.5 text-sm",
    BTN[variant],
  );
}

export function Button({ variant = "primary", size = "md", className, ...props }: ComponentProps<"button"> & { variant?: BtnVariant; size?: "sm" | "md" }) {
  return <button {...props} className={cn(btnClass(variant, size), className)} />;
}

export function LinkButton({ variant = "primary", size = "md", className, ...props }: ComponentProps<typeof Link> & { variant?: BtnVariant; size?: "sm" | "md" }) {
  return <Link {...props} className={cn(btnClass(variant, size), className)} />;
}

export function Card({ className, children, title, actions, padded = true }: { className?: string; children: ReactNode; title?: ReactNode; actions?: ReactNode; padded?: boolean }) {
  return (
    <section className={cn("card", className)}>
      {(title || actions) && (
        <header className="flex min-h-14 items-center justify-between gap-3 border-b border-slate-100 px-5 py-3">
          <h2 className="text-[15px] font-semibold text-slate-900">{title}</h2>
          {actions && <div className="flex items-center gap-2">{actions}</div>}
        </header>
      )}
      <div className={padded ? "p-5" : ""}>{children}</div>
    </section>
  );
}

export function PageHeader({ title, description, actions, back }: { title: ReactNode; description?: ReactNode; actions?: ReactNode; back?: { href: string; label: string } }) {
  return (
    <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        {back && (
          <Link href={back.href} className="mb-2 inline-flex items-center gap-1 rounded-full bg-white px-2.5 py-1 text-xs font-medium text-slate-600 shadow-soft ring-1 ring-slate-200 hover:text-primary-700">
            ← {back.label}
          </Link>
        )}
        <h1 className="text-[26px] font-semibold leading-tight tracking-tight text-slate-950">{title}</h1>
        {description && <p className="mt-1.5 text-sm text-slate-500">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function EmptyState({ title, description, action }: { title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-b from-primary-50 to-white text-primary-500 shadow-soft ring-1 ring-primary-100">
        <Inbox className="h-5 w-5" />
      </div>
      <p className="text-sm font-semibold text-slate-800">{title}</p>
      {description && <p className="mt-1 max-w-sm text-sm text-slate-500">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function Field({ label, name, required, className, hint, children }: { label: string; name?: string; required?: boolean; className?: string; hint?: string; children: ReactNode }) {
  return (
    <div className={className}>
      <label htmlFor={name} className="label">
        {label} {required && <span className="text-rose-500">*</span>}
      </label>
      {children}
      {hint && <p className="mt-1 text-xs text-slate-400">{hint}</p>}
    </div>
  );
}

export function Input(props: ComponentProps<"input">) {
  return <input id={props.name} {...props} className={cn("input", props.className)} />;
}
export function Textarea(props: ComponentProps<"textarea">) {
  return <textarea id={props.name} rows={3} {...props} className={cn("input", props.className)} />;
}
export function Select(props: ComponentProps<"select">) {
  return <select id={props.name} {...props} className={cn("input pr-8", props.className)} />;
}

export function Stat({ label, value, hint, tone = "blue", icon }: { label: string; value: ReactNode; hint?: ReactNode; tone?: "blue" | "sky" | "green" | "amber" | "red" | "violet"; icon?: ReactNode }) {
  const t = {
    blue: ["from-primary-500 to-primary-600", "bg-primary-500"],
    sky: ["from-sky-400 to-sky-600", "bg-sky-500"],
    green: ["from-emerald-400 to-emerald-600", "bg-emerald-500"],
    amber: ["from-amber-400 to-amber-500", "bg-amber-500"],
    red: ["from-rose-400 to-rose-600", "bg-rose-500"],
    violet: ["from-violet-400 to-violet-600", "bg-violet-500"],
  }[tone];
  return (
    <div className="card group relative overflow-hidden p-5 transition-shadow hover:shadow-lift">
      <span className={cn("absolute inset-x-0 top-0 h-[3px] opacity-80", t[1])} />
      <div className="flex items-start justify-between gap-3">
        <p className="text-[13px] font-medium leading-snug text-slate-500">{label}</p>
        {icon && (
          <div className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-b text-white shadow-[inset_0_1px_0_rgb(255_255_255/0.25),0_2px_6px_-1px_rgb(16_24_40/0.2)] [&_svg]:h-[18px] [&_svg]:w-[18px]", t[0])}>{icon}</div>
        )}
      </div>
      <p className="tabular mt-2 text-2xl font-semibold tracking-tight text-slate-950">{value}</p>
      {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
    </div>
  );
}

export function Tabs({ tabs, active }: { tabs: { key: string; label: string; href: string; disabled?: boolean; badge?: string }[]; active: string }) {
  return (
    <nav className="mb-6 flex w-fit max-w-full gap-1 overflow-x-auto rounded-xl bg-slate-100/80 p-1 ring-1 ring-inset ring-slate-200/60">
      {tabs.map((t) =>
        t.disabled ? (
          <span key={t.key} className="flex cursor-not-allowed items-center gap-1 whitespace-nowrap rounded-lg px-3 py-1.5 text-sm text-slate-400">
            {t.label} {t.badge && <span className="rounded bg-slate-100 px-1 text-[10px] text-slate-400">{t.badge}</span>}
          </span>
        ) : (
          <Link
            key={t.key}
            href={t.href}
            className={cn(
              "whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium transition-all",
              active === t.key ? "bg-white text-slate-900 shadow-soft ring-1 ring-slate-200/70" : "text-slate-500 hover:text-slate-800",
            )}
          >
            {t.label}
          </Link>
        ),
      )}
    </nav>
  );
}

export function DL({ items, cols = 3 }: { items: [string, ReactNode][]; cols?: 2 | 3 | 4 }) {
  return (
    <dl className={cn("grid gap-x-6 gap-y-4", cols === 2 ? "sm:grid-cols-2" : cols === 4 ? "sm:grid-cols-2 lg:grid-cols-4" : "sm:grid-cols-2 lg:grid-cols-3")}>
      {items.map(([k, v]) => (
        <div key={k}>
          <dt className="text-[11px] font-semibold uppercase tracking-[0.06em] text-slate-400">{k}</dt>
          <dd className="mt-1 text-sm text-slate-800 whitespace-pre-line">{v === null || v === undefined || v === "" ? "—" : v}</dd>
        </div>
      ))}
    </dl>
  );
}

export function Notice({ tone = "blue", children }: { tone?: "blue" | "amber" | "red" | "green"; children: ReactNode }) {
  const c = {
    blue: "bg-primary-50/70 text-primary-900 ring-primary-200/60 border-l-primary-500",
    amber: "bg-amber-50/80 text-amber-900 ring-amber-200/60 border-l-amber-500",
    red: "bg-rose-50/80 text-rose-900 ring-rose-200/60 border-l-rose-500",
    green: "bg-emerald-50/80 text-emerald-900 ring-emerald-200/60 border-l-emerald-500",
  }[tone];
  return <div className={cn("rounded-xl border-l-[3px] px-4 py-3 text-sm ring-1 ring-inset", c)}>{children}</div>;
}
