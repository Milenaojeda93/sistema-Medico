import { redirect } from "next/navigation";
import { AuthShell } from "@/components/layout/auth-shell";
import { ActionForm, SubmitButton } from "@/components/ui/client";
import { Field, Input } from "@/components/ui";
import { createClinic, logout } from "@/app/auth/actions";
import { getSession } from "@/lib/context";

export const metadata = { title: "Crear institución" };

export default async function Onboarding() {
  const s = await getSession();
  if (s.memberships.length > 0) redirect("/dashboard");
  const pending = (s.user.user_metadata?.pending_clinic as string | undefined) ?? "";
  return (
    <AuthShell title="Creá tu institución" subtitle="Tu cuenta todavía no pertenece a ninguna clínica. Creá una o pedí a un administrador que te invite.">
      <ActionForm action={createClinic} className="space-y-4">
        <Field label="Nombre de la institución" name="name" required><Input name="name" defaultValue={pending} required /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="RUC" name="ruc"><Input name="ruc" /></Field>
          <Field label="Teléfono" name="phone"><Input name="phone" /></Field>
        </div>
        <Field label="Correo de contacto" name="email"><Input name="email" type="email" /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Ciudad" name="city"><Input name="city" /></Field>
          <Field label="Dirección" name="address"><Input name="address" /></Field>
        </div>
        <SubmitButton className="w-full">Crear institución</SubmitButton>
      </ActionForm>
      <form action={logout} className="mt-6 text-center">
        <button className="text-sm text-slate-500 hover:underline">Cerrar sesión</button>
      </form>
    </AuthShell>
  );
}
