import { LinkButton } from "@/components/ui";
import { MODULES } from "@/lib/constants";

export default async function NoAccess({ searchParams }: { searchParams: Promise<{ modulo?: string }> }) {
  const { modulo } = await searchParams;
  const m = MODULES.find((x) => x.key === modulo);
  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <div className="card max-w-md p-8 text-center">
        <h1 className="text-lg font-semibold text-slate-900">Acceso restringido</h1>
        <p className="mt-2 text-sm text-slate-500">Tu rol no tiene permiso para {m ? <>el módulo <b>{m.label}</b></> : "esta sección"}. Si lo necesitás, pedíselo al administrador de la clínica.</p>
        <LinkButton href="/dashboard" className="mt-6">Volver al inicio</LinkButton>
      </div>
    </div>
  );
}
