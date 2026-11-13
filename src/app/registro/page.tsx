import Link from "next/link";
import { AuthShell } from "@/components/layout/auth-shell";
import { ActionForm, SubmitButton } from "@/components/ui/client";
import { Field, Input } from "@/components/ui";
import { register } from "@/app/auth/actions";

export const metadata = { title: "Registrar institución" };

export default function RegisterPage() {
  return (
    <AuthShell title="Registrá tu institución" subtitle="30 días de prueba. Vas a ser el administrador de la clínica.">
      <ActionForm action={register} className="space-y-4">
        <Field label="Nombre de la clínica o consultorio" name="clinic" required><Input name="clinic" required /></Field>
        <Field label="Tu nombre completo" name="full_name" required><Input name="full_name" required /></Field>
        <Field label="Correo electrónico" name="email" required><Input name="email" type="email" required /></Field>
        <Field label="Contraseña" name="password" required hint="Mínimo 8 caracteres"><Input name="password" type="password" minLength={8} required /></Field>
        <SubmitButton className="w-full">Crear cuenta</SubmitButton>
      </ActionForm>
      <p className="mt-6 text-center text-sm text-slate-500">
        ¿Ya tenés cuenta? <Link href="/login" className="font-medium text-primary-600 hover:underline">Iniciá sesión</Link>
      </p>
    </AuthShell>
  );
}
