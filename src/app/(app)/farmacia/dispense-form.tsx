"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { CheckCircle2, Loader2, PackageCheck } from "lucide-react";
import { btnClass } from "@/components/ui";
import { dispensePrescription } from "./actions";

type Product = { id: string; name: string; generic_name: string | null; presentation: string | null; unit: string; available: number };
type RxLine = { drug: string; presentation: string | null; dose: string | null; frequency: string | null; duration: string | null; quantity: string | null };

function guess(drug: string, products: Product[]) {
  const words = drug.toLowerCase().split(/[\s+/,-]+/).filter((w) => w.length > 3);
  const score = (p: Product) => words.filter((w) => `${p.name} ${p.generic_name ?? ""}`.toLowerCase().includes(w)).length;
  const best = [...products].sort((a, b) => score(b) - score(a) || b.available - a.available)[0];
  return best && score(best) > 0 ? best.id : "";
}

export function DispenseForm({ prescriptionId, lines, products }: { prescriptionId: string; lines: RxLine[]; products: Product[] }) {
  const router = useRouter();
  const [rows, setRows] = useState(lines.map((l) => ({ product_id: guess(l.drug, products), quantity: "" })));
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);
  const [pending, start] = useTransition();
  const set = (i: number, k: "product_id" | "quantity", v: string) => setRows((xs) => xs.map((x, j) => (j === i ? { ...x, [k]: v } : x)));

  const submit = () => {
    setError(null);
    start(async () => {
      const res = await dispensePrescription(prescriptionId, rows.map((r) => ({ product_id: r.product_id, quantity: Number(r.quantity.replace(",", ".")) || 0 })), notes);
      if (res.error) { setError(res.error); return; }
      setOk(true); router.refresh();
    });
  };

  if (ok) return <p className="flex items-center gap-2 rounded-xl bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800 ring-1 ring-emerald-200/70"><CheckCircle2 className="h-4 w-4" /> Entrega registrada y stock descontado.</p>;

  return (
    <div className="space-y-4">
      <ol className="space-y-3">
        {lines.map((l, i) => {
          const prod = products.find((p) => p.id === rows[i].product_id);
          return (
            <li key={i} className="rounded-2xl border border-slate-200 bg-white p-4">
              <p className="font-semibold text-slate-900">{i + 1}. {l.drug}{l.presentation ? <span className="font-normal text-slate-600"> — {l.presentation}</span> : null}</p>
              <p className="mb-3 text-xs text-slate-500">{[l.dose, l.frequency, l.duration].filter(Boolean).join(", ")}{l.quantity ? ` · Indicado: ${l.quantity}` : ""}</p>
              <div className="grid gap-3 sm:grid-cols-[1fr_160px]">
                <label><span className="label">Producto a entregar</span>
                  <select className="input" value={rows[i].product_id} onChange={(e) => set(i, "product_id", e.target.value)}>
                    <option value="">No se entrega</option>
                    {products.map((p) => <option key={p.id} value={p.id} disabled={p.available <= 0}>{p.name}{p.presentation ? ` · ${p.presentation}` : ""} — stock {p.available.toLocaleString("es-PY")}</option>)}
                  </select>
                </label>
                <label><span className="label">Cantidad{prod ? ` (${prod.unit})` : ""}</span>
                  <input className="input" type="number" min={0} step="any" value={rows[i].quantity} onChange={(e) => set(i, "quantity", e.target.value)} disabled={!rows[i].product_id} />
                </label>
              </div>
              {prod && Number(rows[i].quantity) > prod.available && <p className="mt-2 text-xs font-medium text-rose-600">Stock insuficiente: hay {prod.available.toLocaleString("es-PY")} {prod.unit}.</p>}
            </li>
          );
        })}
      </ol>
      <label className="block"><span className="label">Observaciones (opcional)</span><input className="input" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Ej.: se entregó genérico equivalente" /></label>
      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 ring-1 ring-red-100">{error}</p>}
      <div className="flex justify-end">
        <button type="button" onClick={submit} disabled={pending || !rows.some((r) => r.product_id && Number(r.quantity) > 0)} className={btnClass("primary")}>
          {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <PackageCheck className="h-4 w-4" />} Registrar entrega
        </button>
      </div>
    </div>
  );
}
