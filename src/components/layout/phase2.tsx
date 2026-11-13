import { Card, LinkButton, PageHeader } from "@/components/ui";
import { MODULES } from "@/lib/constants";

const SCOPE: Record<string, string[]> = {
  recetas: ["Recetas imprimibles en PDF con datos de la clínica, paciente, médico y matrícula", "Medicamentos con dosis, frecuencia, duración e indicaciones", "Historial de recetas en el perfil del paciente"],
  laboratorio: ["Solicitud de análisis y estudios por paciente", "Carga de resultados y adjuntos PDF / imágenes", "Vinculación con la historia clínica y consulta de resultados anteriores"],
  farmacia: ["Catálogo de medicamentos y categorías", "Dispensación vinculada a recetas", "Proveedores"],
  inventario: ["Stock por lote y vencimiento", "Entradas, salidas e historial de movimientos", "Alertas de stock mínimo"],
  reportes: ["Reportes con filtros por fecha, médico, especialidad y aseguradora", "Diagnósticos frecuentes, cancelaciones y ausencias", "Exportación a Excel y PDF"],
};

export function Phase2({ module }: { module: string }) {
  const m = MODULES.find((x) => x.key === module);
  return (
    <>
      <PageHeader title={m?.label ?? module} />
      <Card>
        <div className="mx-auto max-w-xl py-8 text-center">
          <span className="rounded-full bg-primary-50 px-3 py-1 text-xs font-semibold text-primary-700">Próxima fase de desarrollo</span>
          <h2 className="mt-4 text-lg font-semibold text-slate-900">Este módulo todavía no está habilitado</h2>
          <p className="mt-2 text-sm text-slate-500">La base de permisos ya lo contempla. Alcance previsto:</p>
          <ul className="mt-4 space-y-2 text-left text-sm text-slate-700">{(SCOPE[module] ?? []).map((s) => <li key={s} className="flex gap-2"><span className="text-primary-500">•</span>{s}</li>)}</ul>
          {module === "reportes" && <p className="mt-4 text-sm text-slate-500">Mientras tanto, los indicadores principales están en el Dashboard y en Facturación.</p>}
          <LinkButton href="/dashboard" variant="secondary" className="mt-6">Volver al Dashboard</LinkButton>
        </div>
      </Card>
    </>
  );
}
