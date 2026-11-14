export const LAB_STATUS: Record<string, { label: string; tone: "gray" | "blue" | "sky" | "green" | "amber" | "red" | "violet" }> = {
  solicitado: { label: "Solicitado", tone: "amber" },
  en_proceso: { label: "En proceso", tone: "sky" },
  completado: { label: "Resultados listos", tone: "green" },
  anulado: { label: "Anulado", tone: "red" },
};

export const STUDY_GROUPS: { category: "laboratorio" | "imagen" | "otro"; label: string; items: string[] }[] = [
  { category: "laboratorio", label: "Laboratorio", items: ["Hemograma completo", "Glucemia en ayunas", "Hemoglobina glicosilada (HbA1c)", "Perfil lipídico", "Urea y creatinina", "Hepatograma", "TSH y T4 libre", "Orina simple", "Urocultivo", "PCR", "Eritrosedimentación (VSG)", "Ácido úrico", "Electrolitos (Na, K, Cl)", "Coagulograma", "Grupo sanguíneo y factor Rh", "Prueba de embarazo (β-HCG)"] },
  { category: "imagen", label: "Imágenes y otros estudios", items: ["Radiografía de tórax", "Ecografía abdominal", "Ecografía obstétrica", "Ecografía tiroidea", "Mamografía", "Tomografía", "Resonancia magnética", "Electrocardiograma", "Ecocardiograma", "Holter 24 h"] },
];

type Tone = "gray" | "blue" | "sky" | "green" | "amber" | "red" | "violet";
/** Estado a mostrar: un estudio externo sin resultados no es "pendiente" del laboratorio, está indicado al paciente. */
export function labStatus(o: { status: string; location?: string | null }): { label: string; tone: Tone } {
  if (o.location === "externo") {
    if (o.status === "solicitado") return { label: "Indicado · externo", tone: "gray" };
    if (o.status === "en_proceso") return { label: "Resultados parciales", tone: "sky" };
  }
  return LAB_STATUS[o.status] ?? { label: o.status, tone: "gray" };
}
