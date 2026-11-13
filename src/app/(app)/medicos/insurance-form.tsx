"use client";

import { useState } from "react";
import { Field, Input, Select } from "@/components/ui";

/** Aseguradora → planes de esa aseguradora (opcional). */
export function InsurerPlanFields({ insurers, plans }: { insurers: { id: string; trade_name: string }[]; plans: { id: string; insurer_id: string; name: string }[] }) {
  const [ins, setIns] = useState("");
  const own = plans.filter((p) => p.insurer_id === ins);
  return (
    <>
      <Field label="Aseguradora" name="insurer_id" required>
        <Select name="insurer_id" value={ins} onChange={(e) => setIns(e.target.value)} required>
          <option value="">Seleccioná…</option>
          {insurers.map((i) => <option key={i.id} value={i.id}>{i.trade_name}</option>)}
        </Select>
      </Field>
      <Field label="Plan" name="plan_id" hint="Vacío = todos los planes">
        <Select name="plan_id" key={ins} defaultValue="" disabled={!ins}>
          <option value="">Todos los planes</option>
          {own.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </Select>
      </Field>
      <Field label="% que cubre el seguro" name="coverage_percent" hint="Vacío = lo que dice el plan">
        <Input name="coverage_percent" type="number" min={0} max={100} step="1" placeholder="Ej.: 100" />
      </Field>
      <Field label="Copago del paciente (Gs)" name="copay" hint="Opcional">
        <Input name="copay" type="number" min={0} step={1000} placeholder="Ej.: 30000" />
      </Field>
    </>
  );
}
