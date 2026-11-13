import { logout } from "@/app/auth/actions";

export default function Suspended() {
  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <div className="card max-w-md p-8 text-center">
        <h1 className="text-lg font-semibold text-slate-900">Cuenta de la institución suspendida</h1>
        <p className="mt-2 text-sm text-slate-500">El acceso a los datos de esta institución está bloqueado. Contactá al equipo de Medvia para regularizar la suscripción.</p>
        <form action={logout} className="mt-6"><button className="text-sm font-medium text-primary-600 hover:underline">Cerrar sesión</button></form>
      </div>
    </div>
  );
}
