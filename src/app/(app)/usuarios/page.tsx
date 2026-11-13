import Link from "next/link";
import { UserPlus } from "lucide-react";
import { guard, can } from "@/lib/context";
import { Badge, Card, Field, Input, PageHeader, Select, Tabs } from "@/components/ui";
import { ActionForm, Modal, SubmitButton } from "@/components/ui/client";
import { MODULES, ROLES } from "@/lib/constants";
import { fmtDateTime } from "@/lib/utils";
import { addUser, savePermissions, updateMember } from "./actions";

export const metadata = { title: "Usuarios y permisos" };

export default async function Users({ searchParams }: { searchParams: Promise<{ tab?: string; rol?: string }> }) {
  const ctx = await guard("usuarios");
  const sp = await searchParams;
  const tab = sp.tab ?? "usuarios";
  const role = sp.rol && ROLES[sp.rol] ? sp.rol : "recepcionista";
  const [{ data: users }, { data: perms }] = await Promise.all([
    ctx.supabase.rpc("clinic_users", { p_clinic: ctx.clinic.id }),
    ctx.supabase.from("role_permissions").select("*").eq("clinic_id", ctx.clinic.id).eq("role", role),
  ]);
  const editable = can(ctx.perms, "usuarios", "edit");
  const roleOptions = Object.entries(ROLES).filter(([k]) => k !== "admin_clinica" || ctx.role === "admin_clinica");

  return (
    <>
      <PageHeader title="Usuarios y permisos" description="Acceso por rol, módulo y acción. Cada usuario sólo ve la información de esta institución."
        actions={can(ctx.perms, "usuarios", "create") && (
          <Modal trigger={<><UserPlus className="h-4 w-4" /> Agregar usuario</>} title="Agregar usuario" size="sm">
            <ActionForm action={addUser} className="space-y-4">
              <Field label="Nombre completo" name="full_name" required><Input name="full_name" required /></Field>
              <Field label="Correo electrónico" name="email" required><Input name="email" type="email" required /></Field>
              <Field label="Rol" name="role"><Select name="role" defaultValue="recepcionista">{roleOptions.map(([k, v]) => <option key={k} value={k}>{v}</option>)}</Select></Field>
              <Field label="Contraseña inicial" name="password" hint="Sólo si el usuario todavía no tiene cuenta en Medvia (mín. 8 caracteres). Compartila por un canal seguro."><Input name="password" type="password" minLength={8} autoComplete="new-password" /></Field>
              <div className="flex justify-end"><SubmitButton>Agregar</SubmitButton></div>
            </ActionForm>
          </Modal>
        )} />
      <Tabs active={tab} tabs={[{ key: "usuarios", label: "Usuarios", href: "/usuarios" }, { key: "permisos", label: "Permisos por rol", href: "/usuarios?tab=permisos" }]} />

      {tab === "usuarios" ? (
        <Card padded={false}>
          <table className="table-base">
            <thead><tr><th>Usuario</th><th>Rol</th><th>Estado</th><th>Último acceso</th><th>Alta</th><th /></tr></thead>
            <tbody>{(users ?? []).map((u: { member_id: string; user_id: string; full_name: string | null; email: string; role: string; active: boolean; created_at: string; last_sign_in_at: string | null }) => (
              <tr key={u.member_id}>
                <td><p className="font-medium text-slate-900">{u.full_name ?? "—"}{u.user_id === ctx.user.id && <span className="ml-2 text-xs text-slate-400">(vos)</span>}</p><p className="text-xs text-slate-500">{u.email}</p></td>
                <td><Badge tone={u.role === "admin_clinica" ? "violet" : "blue"}>{ROLES[u.role]}</Badge></td>
                <td>{u.active ? <Badge tone="green">Activo</Badge> : <Badge>Inactivo</Badge>}</td>
                <td className="text-xs">{fmtDateTime(u.last_sign_in_at, ctx.tz)}</td><td className="text-xs">{fmtDateTime(u.created_at, ctx.tz)}</td>
                <td className="text-right">{editable && u.user_id !== ctx.user.id && (u.role !== "admin_clinica" || ctx.role === "admin_clinica") && (
                  <Modal trigger="Editar" title={`Editar acceso · ${u.full_name ?? u.email}`} triggerVariant="ghost" triggerSize="sm" size="sm">
                    <ActionForm action={updateMember.bind(null, u.member_id)} className="space-y-4">
                      <Field label="Rol" name="role"><Select name="role" defaultValue={u.role}>{roleOptions.map(([k, v]) => <option key={k} value={k}>{v}</option>)}</Select></Field>
                      <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="active" defaultChecked={u.active} className="rounded border-slate-300" /> Acceso activo</label>
                      <div className="flex justify-end"><SubmitButton>Guardar</SubmitButton></div>
                    </ActionForm>
                  </Modal>
                )}</td>
              </tr>
            ))}</tbody>
          </table>
        </Card>
      ) : (
        <Card padded={false}>
          <div className="flex flex-wrap gap-2 border-b border-slate-100 p-4">
            {Object.entries(ROLES).map(([k, v]) => (
              <Link key={k} href={`/usuarios?tab=permisos&rol=${k}`} className={`rounded-full px-3 py-1 text-sm ${k === role ? "bg-primary-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}>{v}</Link>
            ))}
          </div>
          {role === "admin_clinica" ? <p className="p-5 text-sm text-slate-500">El Administrador de clínica tiene acceso total y no puede restringirse.</p> : (
            <ActionForm key={role} action={savePermissions}>
              <input type="hidden" name="role" value={role} />
              <table className="table-base">
                <thead><tr><th>Módulo</th>{["Ver", "Crear", "Editar", "Eliminar"].map((h) => <th key={h} className="text-center">{h}</th>)}</tr></thead>
                <tbody>{MODULES.map((m) => {
                  const p = perms?.find((x) => x.module === m.key);
                  return (
                    <tr key={m.key}>
                      <td className="font-medium">{m.label}</td>
                      {(["view", "create", "edit", "delete"] as const).map((a) => (
                        <td key={a} className="text-center"><input type="checkbox" name={`${m.key}:${a}`} defaultChecked={Boolean(p?.[`can_${a}`])} disabled={!editable} className="h-4 w-4 rounded border-slate-300" /></td>
                      ))}
                    </tr>
                  );
                })}</tbody>
              </table>
              {editable && <div className="flex justify-end border-t border-slate-100 p-4"><SubmitButton>Guardar permisos de {ROLES[role]}</SubmitButton></div>}
            </ActionForm>
          )}
        </Card>
      )}
    </>
  );
}
