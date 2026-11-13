# Medvia — Fase 1 (núcleo funcional)

SaaS multi-clínica de gestión médica. Next.js 16 + TypeScript + Tailwind 4 + Supabase (Postgres, Auth, Storage, RLS) + Recharts.

## Usuarios demo
`supabase/seed.sql` crea dos clínicas de prueba con usuarios para cada rol (administrador, médico, recepción, admin de otra clínica y superadministrador). Antes de ejecutarlo, reemplazá `CAMBIAR_CONTRASEÑA` por una contraseña propia. No publiques credenciales en este repositorio.

## Correr local
```
npm install
cp .env.example .env.local   # URL y publishable key de Supabase
npm run dev
```

## Base de datos
`supabase/migrations/` (aplicar en orden) y `supabase/seed.sql` (datos demo).
- Multi-tenant: toda tabla operativa tiene `clinic_id`; RLS por permisos de rol (`has_perm`) + triggers que impiden referencias cruzadas entre clínicas.
- Permisos por rol × módulo × acción en `role_permissions`, editables desde la UI.
- Historia clínica: consulta cerrada = inmutable; correcciones vía `amend_consultation` (enmiendas auditables).
- Agenda: exclusion constraints impiden superposición por profesional y por consultorio.
- Cobertura: `compute_coverage` (plan, vigencia, límites anuales, autorización aprobada, copago, tope). Nada se asume cubierto sin regla.
- Facturación: `create_invoice`, `register_payment`, `void_invoice`; aseguradoras: `create_settlement`, `submit_settlement`, `reject_settlement_item`, `register_insurer_payment`.
- Auditoría: trigger genérico sobre todas las tablas operativas → `audit_log`.

## Fase 2 (pendiente)
Recetas en PDF, Laboratorio y estudios, Farmacia, Inventario, Reportes con exportación Excel/PDF; deducible y límite anual en Gs. aplicados al cálculo.
