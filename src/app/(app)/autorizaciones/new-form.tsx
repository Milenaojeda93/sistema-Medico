"use client";

import { useState } from "react";
import { Field, Input, Select, Textarea } from "@/components/ui";
import { ActionForm, SubmitButton } from "@/components/ui/client";
import { createAuthorization } from "./actions";

type Ins = { id: string; patient_id: string; insurer_name: string; plan_name: string; member_number: string; effective_status: string };

export function NewAuthorizationForm({ patients, insurances, services, doctors, defaultPatient, today }: {
  patients: { id: string; name: string }[]; insurances: Ins[]; services: { id: string; name: string }[]; doctors: { id: string; full_name: string }[]; defaultPatient?: string; today: string;
}) {
  const [pid, setPid] = useState(defaultPatient ?? "");
  const ins = insurances.filter((i) => i.patient_id === pid);
  return (
    <ActionForm action={createAuthorization} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Paciente" name="patient_id" required className="sm:col-span-2">
          <Select name="patient_id" value={pid} onChange={(e) => setPid(e.target.value)} required>
            <option value="">Seleccioná…</option>{patients.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </Select>
        </Field>
        <Field label="Seguro / plan" name="patient_insurance_id" required className="sm:col-span-2">
          <Select name="patient_insurance_id" required key={pid}>
            {!ins.length && <option value="">{pid ? "El paciente no tiene seguros" : "Elegí un paciente"}</option>}
            {ins.map((i) => <option key={i.id} value={i.id}>{i.insurer_name} — {i.plan_name} · {i.member_number}{i.effective_status !== "activo" ? ` (${i.effective_status})` : ""}</option>)}
          </Select>
        </Field>
        <Field label="Servicio del catálogo" name="service_id">
          <Select name="service_id"><option value="">Otro (describir)</option>{services.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</Select>
        </Field>
        <Field label="Descripción del servicio" name="service_description" hint="Obligatoria si no elegís del catálogo"><Input name="service_description" /></Field>
        <Field label="Profesional responsable" name="doctor_id">
          <Select name="doctor_id"><option value="">—</option>{doctors.map((d) => <option key={d.id} value={d.id}>{d.full_name}</option>)}</Select>
        </Field>
        <Field label="Número de solicitud" name="request_number"><Input name="request_number" /></Field>
        <Field label="Fecha de solicitud" name="request_date"><Input name="request_date" type="date" defaultValue={today} /></Field>
        <Field label="Orden / documento adjunto" name="file"><Input name="file" type="file" accept="application/pdf,image/*" /></Field>
        <Field label="Observaciones" name="notes" className="sm:col-span-2"><Textarea name="notes" rows={2} /></Field>
      </div>
      <div className="flex justify-end"><SubmitButton>Registrar solicitud</SubmitButton></div>
    </ActionForm>
  );
}
