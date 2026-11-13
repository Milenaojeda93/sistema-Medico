"use client";

import { useState } from "react";
import { Field } from "@/components/ui";
import { SearchSelect, type Option } from "@/components/ui/pickers";

type Doc = { id: string; full_name: string; specialties: string[] };

export function ConsultaPickers({ patients, doctors, specialties, defaultDoctor = "", defaultSpecialty = "" }: {
  patients: Option[] | null; doctors: Doc[]; specialties: { id: string; name: string }[]; defaultDoctor?: string; defaultSpecialty?: string;
}) {
  const initialSpec = defaultSpecialty || (doctors.find((d) => d.id === defaultDoctor)?.specialties.length === 1 ? doctors.find((d) => d.id === defaultDoctor)!.specialties[0] : "");
  const [spec, setSpec] = useState(initialSpec);
  const [doc, setDoc] = useState(defaultDoctor);
  const specName = (id: string) => specialties.find((s) => s.id === id)?.name;

  const docs = spec ? doctors.filter((d) => d.specialties.includes(spec)) : doctors;
  const docOptions: Option[] = docs.map((d) => ({ value: d.id, label: d.full_name, hint: d.specialties.map(specName).filter(Boolean).join(" · ") || undefined }));

  return (
    <>
      {patients && (
        <Field label="Paciente" name="patient_id" required>
          <SearchSelect name="patient_id" required options={patients} placeholder="Buscá por nombre o CI…" emptyText="No se encontró el paciente" />
        </Field>
      )}
      <Field label="Especialidad" name="specialty_id">
        <SearchSelect name="specialty_id" value={spec} placeholder="Buscá la especialidad…"
          options={specialties.map((s) => ({ value: s.id, label: s.name }))}
          onChange={(v) => { setSpec(v); if (v && doc && !doctors.find((d) => d.id === doc)?.specialties.includes(v)) setDoc(""); }} />
      </Field>
      <Field label="Profesional responsable" name="doctor_id" required>
        <SearchSelect name="doctor_id" required value={doc} options={docOptions} placeholder="Buscá el profesional…"
          emptyText={spec ? "No hay profesionales con esa especialidad" : "Sin resultados"}
          onChange={(v) => { setDoc(v); const d = doctors.find((x) => x.id === v); if (d && !spec && d.specialties.length === 1) setSpec(d.specialties[0]); }} />
      </Field>
    </>
  );
}
