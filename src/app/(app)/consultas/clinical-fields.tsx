import { Field, Input, Textarea } from "@/components/ui";

type C = Record<string, string | number | null> | null | undefined;

export function ClinicalFields({ c, compact = false }: { c?: C; compact?: boolean }) {
  if (compact) return <CompactFields c={c} />;
  const v = (k: string) => (c?.[k] ?? "") as string | number;
  const bmi = c?.weight_kg && c?.height_cm ? (Number(c.weight_kg) / (Number(c.height_cm) / 100) ** 2).toFixed(1) : null;
  return (
    <div className="space-y-6">
      <section>
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
          <h3 className="text-sm font-semibold text-slate-800">Motivo y anamnesis</h3>
          <p className="text-xs text-slate-500">Los campos con <span className="text-rose-500">*</span> son obligatorios. El resto es opcional.</p>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Motivo de consulta" name="reason" required className="md:col-span-2"><Input name="reason" defaultValue={v("reason")} required /></Field>
          <Field label="Síntomas" name="symptoms"><Textarea name="symptoms" defaultValue={v("symptoms")} /></Field>
          <Field label="Antecedentes relevantes" name="background"><Textarea name="background" defaultValue={v("background")} /></Field>
        </div>
      </section>
      <section>
        <h3 className="mb-3 text-sm font-semibold text-slate-800">Signos vitales <span className="text-xs font-normal text-slate-400">(opcional)</span> {bmi && <span className="ml-2 text-xs font-normal text-slate-500">IMC {bmi}</span>}</h3>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4 lg:grid-cols-8">
          <Field label="PA sistólica" name="bp_systolic"><Input name="bp_systolic" type="number" inputMode="numeric" placeholder="mmHg" defaultValue={v("bp_systolic")} /></Field>
          <Field label="PA diastólica" name="bp_diastolic"><Input name="bp_diastolic" type="number" placeholder="mmHg" defaultValue={v("bp_diastolic")} /></Field>
          <Field label="Temperatura" name="temperature"><Input name="temperature" type="number" step="0.1" placeholder="°C" defaultValue={v("temperature")} /></Field>
          <Field label="Frec. cardíaca" name="heart_rate"><Input name="heart_rate" type="number" placeholder="lpm" defaultValue={v("heart_rate")} /></Field>
          <Field label="Frec. respiratoria" name="respiratory_rate"><Input name="respiratory_rate" type="number" placeholder="rpm" defaultValue={v("respiratory_rate")} /></Field>
          <Field label="Sat. O₂" name="oxygen_saturation"><Input name="oxygen_saturation" type="number" placeholder="%" defaultValue={v("oxygen_saturation")} /></Field>
          <Field label="Peso" name="weight_kg"><Input name="weight_kg" type="number" step="0.1" placeholder="kg" defaultValue={v("weight_kg")} /></Field>
          <Field label="Altura" name="height_cm"><Input name="height_cm" type="number" step="0.1" placeholder="cm" defaultValue={v("height_cm")} /></Field>
        </div>
      </section>
      <section>
        <h3 className="mb-3 text-sm font-semibold text-slate-800">Diagnóstico y plan</h3>
        <div className="grid gap-4 md:grid-cols-4">
          <Field label="Diagnóstico" name="diagnosis" required hint="Obligatorio para finalizar la atención" className="md:col-span-3"><Input name="diagnosis" defaultValue={v("diagnosis")} placeholder="Ej.: Faringitis aguda" /></Field>
          <Field label="Código CIE-10" name="diagnosis_code"><Input name="diagnosis_code" defaultValue={v("diagnosis_code")} placeholder="Ej.: J02.9" /></Field>
          <Field label="Tratamiento" name="treatment" className="md:col-span-2"><Textarea name="treatment" defaultValue={v("treatment")} /></Field>
          <Field label="Indicaciones" name="instructions" className="md:col-span-2"><Textarea name="instructions" defaultValue={v("instructions")} /></Field>
          <Field label="Observaciones" name="observations" className="md:col-span-2"><Textarea name="observations" defaultValue={v("observations")} /></Field>
          <Field label="Evolución médica" name="evolution" className="md:col-span-2"><Textarea name="evolution" defaultValue={v("evolution")} /></Field>
        </div>
      </section>
    </div>
  );
}

/** Versión simple para atender: lo esencial a la vista y el resto en "Signos vitales y más datos". */
function CompactFields({ c }: { c?: C }) {
  const v = (k: string) => (c?.[k] ?? "") as string | number;
  const extra = ["background", "bp_systolic", "bp_diastolic", "temperature", "heart_rate", "respiratory_rate", "oxygen_saturation", "weight_kg", "height_cm", "observations", "evolution"];
  const hasExtra = extra.some((k) => c?.[k] !== null && c?.[k] !== undefined && c?.[k] !== "");
  return (
    <div className="space-y-5">
      <p className="text-xs text-slate-500">Los campos con <span className="text-rose-500">*</span> son obligatorios. El resto es opcional.</p>
      <Field label="Motivo de consulta" name="reason" required><Input name="reason" defaultValue={v("reason")} required placeholder="Ej.: Dolor de garganta y fiebre" /></Field>
      <Field label="Síntomas" name="symptoms"><Textarea name="symptoms" rows={2} defaultValue={v("symptoms")} placeholder="Qué siente, desde cuándo…" /></Field>
      <div className="grid gap-4 md:grid-cols-4">
        <Field label="Diagnóstico" name="diagnosis" required hint="Obligatorio para finalizar la atención" className="md:col-span-3"><Input name="diagnosis" defaultValue={v("diagnosis")} placeholder="Ej.: Faringitis aguda" /></Field>
        <Field label="Código CIE-10" name="diagnosis_code"><Input name="diagnosis_code" defaultValue={v("diagnosis_code")} placeholder="Ej.: J02.9" /></Field>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Tratamiento" name="treatment"><Textarea name="treatment" rows={3} defaultValue={v("treatment")} /></Field>
        <Field label="Indicaciones al paciente" name="instructions"><Textarea name="instructions" rows={3} defaultValue={v("instructions")} placeholder="Reposo, líquidos, cuándo volver…" /></Field>
      </div>
      <details open={hasExtra} className="group rounded-xl border border-slate-200 bg-slate-50/60">
        <summary className="flex cursor-pointer select-none items-center justify-between gap-2 px-4 py-3 text-sm font-medium text-slate-700">
          <span>Signos vitales y más datos <span className="font-normal text-slate-400">(opcional)</span></span>
          <span className="text-xs text-primary-600 group-open:hidden">Mostrar</span><span className="hidden text-xs text-primary-600 group-open:inline">Ocultar</span>
        </summary>
        <div className="space-y-4 border-t border-slate-200 bg-white px-4 py-4">
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <Field label="PA sistólica" name="bp_systolic"><Input name="bp_systolic" type="number" inputMode="numeric" placeholder="mmHg" defaultValue={v("bp_systolic")} /></Field>
            <Field label="PA diastólica" name="bp_diastolic"><Input name="bp_diastolic" type="number" placeholder="mmHg" defaultValue={v("bp_diastolic")} /></Field>
            <Field label="Temperatura" name="temperature"><Input name="temperature" type="number" step="0.1" placeholder="°C" defaultValue={v("temperature")} /></Field>
            <Field label="Frec. cardíaca" name="heart_rate"><Input name="heart_rate" type="number" placeholder="lpm" defaultValue={v("heart_rate")} /></Field>
            <Field label="Frec. respiratoria" name="respiratory_rate"><Input name="respiratory_rate" type="number" placeholder="rpm" defaultValue={v("respiratory_rate")} /></Field>
            <Field label="Sat. O₂" name="oxygen_saturation"><Input name="oxygen_saturation" type="number" placeholder="%" defaultValue={v("oxygen_saturation")} /></Field>
            <Field label="Peso" name="weight_kg"><Input name="weight_kg" type="number" step="0.1" placeholder="kg" defaultValue={v("weight_kg")} /></Field>
            <Field label="Altura" name="height_cm"><Input name="height_cm" type="number" step="0.1" placeholder="cm" defaultValue={v("height_cm")} /></Field>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            <Field label="Antecedentes relevantes" name="background"><Textarea name="background" rows={2} defaultValue={v("background")} /></Field>
            <Field label="Observaciones" name="observations"><Textarea name="observations" rows={2} defaultValue={v("observations")} /></Field>
            <Field label="Evolución médica" name="evolution"><Textarea name="evolution" rows={2} defaultValue={v("evolution")} /></Field>
          </div>
        </div>
      </details>
    </div>
  );
}
