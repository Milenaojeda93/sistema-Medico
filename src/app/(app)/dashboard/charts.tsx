"use client";

import { Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

const BLUE = "#2563eb";
const ORANGE = "#eb6834";
const AXIS = { fontSize: 11, fill: "#64748b" };
const MONTHS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
const monthLabel = (m: string) => MONTHS[Number(m.slice(5, 7)) - 1] + " " + m.slice(2, 4);
const gsShort = (n: number) => (n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1).replace(".", ",")} M` : n >= 1000 ? `${Math.round(n / 1000)} mil` : String(n));
const gs = (n: number) => "Gs. " + Math.round(n).toLocaleString("es-PY");
const tooltipStyle = { contentStyle: { borderRadius: 10, border: "1px solid #e2e8f0", fontSize: 12, boxShadow: "0 4px 12px rgb(0 0 0 / .06)" } };

function Empty() {
  return <div className="flex h-full items-center justify-center text-sm text-slate-400">Sin datos en el período</div>;
}

export function ConsultationsByDay({ data, byMonth = false }: { data: { date: string; total: number }[]; byMonth?: boolean }) {
  const MONTHS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
  const rows = data.map((d) => ({ ...d, label: byMonth ? `${MONTHS[Number(d.date.slice(5, 7)) - 1]} ${d.date.slice(2, 4)}` : d.date.slice(8, 10) + "/" + d.date.slice(5, 7) }));
  const interval = Math.max(0, Math.ceil(rows.length / 10) - 1);
  const tip = <Tooltip {...tooltipStyle} formatter={(v) => [v as number, "Consultas"]} labelFormatter={(l) => (byMonth ? String(l) : `Día ${l}`)} cursor={{ fill: "#f8fafc", stroke: "#cbd5e1" }} />;
  if (rows.length <= 14) {
    return (
      <ResponsiveContainer width="100%" height={240}>
        <BarChart data={rows} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke="#f1f5f9" />
          <XAxis dataKey="label" tick={AXIS} tickLine={false} axisLine={{ stroke: "#e2e8f0" }} />
          <YAxis allowDecimals={false} tick={AXIS} tickLine={false} axisLine={false} />
          {tip}
          <Bar dataKey="total" fill={BLUE} radius={[4, 4, 0, 0]} maxBarSize={48} />
        </BarChart>
      </ResponsiveContainer>
    );
  }
  return (
    <ResponsiveContainer width="100%" height={240}>
      <LineChart data={rows} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
        <CartesianGrid vertical={false} stroke="#f1f5f9" />
        <XAxis dataKey="label" tick={AXIS} tickLine={false} axisLine={{ stroke: "#e2e8f0" }} interval={interval} />
        <YAxis allowDecimals={false} tick={AXIS} tickLine={false} axisLine={false} />
        {tip}
        <Line type="monotone" dataKey="total" stroke={BLUE} strokeWidth={2} dot={false} activeDot={{ r: 5, strokeWidth: 2, stroke: "#fff" }} />
      </LineChart>
    </ResponsiveContainer>
  );
}

export function BySpecialty({ data }: { data: { name: string; total: number }[] }) {
  if (!data.length) return <div className="h-60"><Empty /></div>;
  return (
    <ResponsiveContainer width="100%" height={Math.max(160, data.length * 34)}>
      <BarChart data={data} layout="vertical" margin={{ top: 0, right: 24, left: 8, bottom: 0 }} barCategoryGap={6}>
        <XAxis type="number" hide allowDecimals={false} />
        <YAxis type="category" dataKey="name" width={110} tick={AXIS} tickLine={false} axisLine={false} />
        <Tooltip {...tooltipStyle} formatter={(v) => [v as number, "Consultas"]} cursor={{ fill: "#f8fafc" }} />
        <Bar dataKey="total" fill={BLUE} radius={[0, 4, 4, 0]} label={{ position: "right", fontSize: 11, fill: "#334155" }} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function IncomeByMonth({ data }: { data: { month: string; particular: number; aseguradoras: number }[] }) {
  const rows = data.map((d) => ({ ...d, label: monthLabel(d.month) }));
  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={rows} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} barGap={2}>
        <CartesianGrid vertical={false} stroke="#f1f5f9" />
        <XAxis dataKey="label" tick={AXIS} tickLine={false} axisLine={{ stroke: "#e2e8f0" }} />
        <YAxis tick={AXIS} tickLine={false} axisLine={false} tickFormatter={gsShort} width={56} />
        <Tooltip {...tooltipStyle} formatter={(v, n) => [gs(v as number), n === "particular" ? "Cobros a pacientes" : "Pagos de aseguradoras"]} cursor={{ fill: "#f8fafc" }} />
        <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} formatter={(v) => <span className="text-slate-600">{v === "particular" ? "Cobros a pacientes" : "Pagos de aseguradoras"}</span>} />
        <Bar dataKey="particular" fill={BLUE} radius={[4, 4, 0, 0]} maxBarSize={28} />
        <Bar dataKey="aseguradoras" fill={ORANGE} radius={[4, 4, 0, 0]} maxBarSize={28} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function NewPatients({ data }: { data: { month: string; total: number }[] }) {
  const rows = data.map((d) => ({ ...d, label: monthLabel(d.month) }));
  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={rows} margin={{ top: 16, right: 8, left: -20, bottom: 0 }}>
        <CartesianGrid vertical={false} stroke="#f1f5f9" />
        <XAxis dataKey="label" tick={AXIS} tickLine={false} axisLine={{ stroke: "#e2e8f0" }} />
        <YAxis allowDecimals={false} tick={AXIS} tickLine={false} axisLine={false} />
        <Tooltip {...tooltipStyle} formatter={(v) => [v as number, "Pacientes nuevos"]} cursor={{ fill: "#f8fafc" }} />
        <Bar dataKey="total" fill={BLUE} radius={[4, 4, 0, 0]} maxBarSize={32} label={{ position: "top", fontSize: 11, fill: "#334155" }} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function CareType({ data }: { data: { name: string; total: number }[] }) {
  if (!data.length) return <div className="h-48"><Empty /></div>;
  const total = data.reduce((a, b) => a + b.total, 0);
  const rows = ["seguro", "particular"].map((k) => ({ name: k === "seguro" ? "Por seguro" : "Particular", key: k, total: data.find((d) => d.name === k)?.total ?? 0 }));
  return (
    <div className="flex items-center gap-4">
      <ResponsiveContainer width="50%" height={180}>
        <PieChart>
          <Pie data={rows} dataKey="total" nameKey="name" innerRadius={50} outerRadius={78} paddingAngle={2} stroke="#fff" strokeWidth={2}>
            {rows.map((r) => <Cell key={r.key} fill={r.key === "seguro" ? BLUE : ORANGE} />)}
          </Pie>
          <Tooltip {...tooltipStyle} formatter={(v, n) => [`${v} citas`, n]} />
        </PieChart>
      </ResponsiveContainer>
      <ul className="space-y-3 text-sm">
        {rows.map((r) => (
          <li key={r.key}>
            <div className="flex items-center gap-2 text-slate-600">
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: r.key === "seguro" ? BLUE : ORANGE }} /> {r.name}
            </div>
            <p className="pl-4.5 text-lg font-semibold text-slate-900">{total ? Math.round((r.total / total) * 100) : 0}% <span className="text-xs font-normal text-slate-500">({r.total})</span></p>
          </li>
        ))}
      </ul>
    </div>
  );
}
