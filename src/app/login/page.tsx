import Link from "next/link";
import { AuthShell } from "@/components/layout/auth-shell";
import { ActionForm, SubmitButton } from "@/components/ui/client";
import { Field, Input } from "@/components/ui";
import { login } from "@/app/auth/actions";

export const metadata = { title: "Iniciar sesión" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  return (
    <AuthShell title="Iniciar sesión" subtitle="Ingresá con tu cuenta de Medvia">
      <ActionForm action={login} className="space-y-4">
        <input type="hidden" name="next" value={next ?? ""} />
        <Field label="Correo electrónico" name="email"><Input name="email" type="email" autoComplete="email" required /></Field>
        <Field label="Contraseña" name="password"><Input name="password" type="password" autoComplete="current-password" required /></Field>
        <SubmitButton className="w-full">Ingresar</SubmitButton>
      </ActionForm>
      <p className="mt-6 text-center text-sm text-slate-500">
        ¿Tu institución todavía no usa Medvia? <Link href="/registro" className="font-medium text-primary-600 hover:underline">Registrala</Link>
      </p>
    </AuthShell>
  );
}
