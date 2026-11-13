export type Action = "view" | "create" | "edit" | "delete";

export const MODULES = [
  { key: "dashboard", label: "Dashboard", href: "/dashboard", icon: "LayoutDashboard", group: "General" },
  { key: "pacientes", label: "Pacientes", href: "/pacientes", icon: "Users", group: "Atención" },
  { key: "agenda", label: "Agenda médica", href: "/agenda", icon: "CalendarDays", group: "Atención" },
  { key: "consultas", label: "Consultas", href: "/consultas", icon: "Stethoscope", group: "Atención" },
  { key: "historias", label: "Historias clínicas", href: "/historias", icon: "FileHeart", group: "Atención" },
  { key: "medicos", label: "Médicos y profesionales", href: "/medicos", icon: "UserRound", group: "Atención" },
  { key: "especialidades", label: "Especialidades", href: "/especialidades", icon: "Shapes", group: "Atención" },
  { key: "seguros", label: "Seguros médicos", href: "/seguros", icon: "ShieldCheck", group: "Seguros" },
  { key: "aseguradoras", label: "Aseguradoras", href: "/aseguradoras", icon: "Building2", group: "Seguros" },
  { key: "autorizaciones", label: "Autorizaciones", href: "/autorizaciones", icon: "BadgeCheck", group: "Seguros" },
  { key: "recetas", label: "Recetas médicas", href: "/recetas", icon: "Pill", group: "Clínico" },
  { key: "laboratorio", label: "Laboratorio y estudios", href: "/laboratorio", icon: "FlaskConical", group: "Clínico" },
  { key: "farmacia", label: "Farmacia", href: "/farmacia", icon: "Cross", group: "Clínico" },
  { key: "inventario", label: "Inventario", href: "/inventario", icon: "Boxes", group: "Clínico" },
  { key: "facturacion", label: "Facturación", href: "/facturacion", icon: "Receipt", group: "Finanzas" },
  { key: "caja", label: "Caja y pagos", href: "/caja", icon: "Wallet", group: "Finanzas" },
  { key: "reportes", label: "Reportes", href: "/reportes", icon: "BarChart3", group: "Finanzas" },
  { key: "usuarios", label: "Usuarios y permisos", href: "/usuarios", icon: "KeyRound", group: "Administración" },
  { key: "configuracion", label: "Configuración", href: "/configuracion", icon: "Settings", group: "Administración" },
  { key: "auditoria", label: "Auditoría", href: "/auditoria", icon: "ScrollText", group: "Administración" },
] as const;

export type ModuleKey = (typeof MODULES)[number]["key"];

export const ROLES: Record<string, string> = {
  admin_clinica: "Administrador de clínica",
  administrador: "Administrador",
  recepcionista: "Recepcionista",
  medico: "Médico",
  enfermeria: "Enfermería",
  laboratorio: "Laboratorio",
  farmacia: "Farmacia",
  caja: "Caja",
};

type Tone = "gray" | "blue" | "sky" | "green" | "amber" | "red" | "violet";

export const APPOINTMENT_STATUS: Record<string, { label: string; tone: Tone }> = {
  pendiente: { label: "Pendiente", tone: "amber" },
  confirmada: { label: "Confirmada", tone: "blue" },
  en_espera: { label: "En espera", tone: "violet" },
  en_atencion: { label: "En atención", tone: "sky" },
  atendida: { label: "Atendida", tone: "green" },
  cancelada: { label: "Cancelada", tone: "gray" },
  ausente: { label: "Ausente", tone: "red" },
};

export const INSURANCE_STATUS: Record<string, { label: string; tone: Tone }> = {
  activo: { label: "Activo", tone: "green" },
  suspendido: { label: "Suspendido", tone: "amber" },
  vencido: { label: "Vencido", tone: "red" },
};

export const AUTH_STATUS: Record<string, { label: string; tone: Tone }> = {
  pendiente: { label: "Pendiente", tone: "amber" },
  en_revision: { label: "En revisión", tone: "sky" },
  aprobada: { label: "Aprobada", tone: "green" },
  rechazada: { label: "Rechazada", tone: "red" },
  vencida: { label: "Vencida", tone: "gray" },
};

export const INVOICE_STATUS: Record<string, { label: string; tone: Tone }> = {
  pendiente: { label: "Pendiente", tone: "amber" },
  parcial: { label: "Pago parcial", tone: "sky" },
  pagada: { label: "Pagada", tone: "green" },
  anulada: { label: "Anulada", tone: "gray" },
};

export const SETTLEMENT_STATUS: Record<string, { label: string; tone: Tone }> = {
  borrador: { label: "Borrador", tone: "gray" },
  presentada: { label: "Presentada", tone: "blue" },
  pagada_parcial: { label: "Pagada parcial", tone: "sky" },
  pagada: { label: "Pagada", tone: "green" },
  rechazada: { label: "Rechazada", tone: "red" },
};

export const CLINIC_STATUS: Record<string, { label: string; tone: Tone }> = {
  prueba: { label: "Prueba", tone: "sky" },
  activa: { label: "Activa", tone: "green" },
  suspendida: { label: "Suspendida", tone: "amber" },
  cancelada: { label: "Cancelada", tone: "red" },
};

export const CATEGORIES: Record<string, string> = {
  consulta: "Consultas",
  laboratorio: "Estudios de laboratorio",
  radiografia: "Radiografías",
  ecografia: "Ecografías",
  procedimiento: "Procedimientos médicos",
  medicamento: "Medicamentos",
  internacion: "Internaciones",
  otro: "Otros",
};

export const PAYMENT_METHODS: Record<string, string> = {
  efectivo: "Efectivo",
  tarjeta_debito: "Tarjeta de débito",
  tarjeta_credito: "Tarjeta de crédito",
  transferencia: "Transferencia",
  cheque: "Cheque",
  otro: "Otro",
};

export const BLOOD_TYPES = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];
export const WEEKDAYS = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];

export const TABLE_LABELS: Record<string, string> = {
  patients: "Paciente",
  appointments: "Cita",
  consultations: "Consulta",
  consultation_amendments: "Enmienda",
  invoices: "Factura",
  payments: "Pago",
  authorizations: "Autorización",
  patient_insurances: "Seguro de paciente",
  doctors: "Profesional",
  doctor_schedules: "Horario",
  specialties: "Especialidad",
  rooms: "Consultorio",
  services: "Servicio",
  insurers: "Aseguradora",
  insurance_plans: "Plan",
  plan_coverages: "Cobertura",
  clinic_members: "Usuario",
  role_permissions: "Permiso",
  clinics: "Institución",
  insurer_settlements: "Liquidación",
  settlement_items: "Ítem de liquidación",
  insurer_payments: "Pago de aseguradora",
  patient_documents: "Documento",
};

export const ACTION_LABELS: Record<string, string> = { insert: "creó", update: "modificó", delete: "eliminó" };
