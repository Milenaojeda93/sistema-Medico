"use client";

import { useFormStatus } from "react-dom";
import { Loader2, Stethoscope } from "lucide-react";
import { btnClass } from "@/components/ui";
import { cn } from "@/lib/utils";
import { startConsultation } from "./actions";

function Btn({ label, variant, size, className }: { label: string; variant: "primary" | "secondary" | "success"; size: "sm" | "md"; className?: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={cn(btnClass(variant, size), className)}>
      {pending ? <Loader2 className={size === "sm" ? "h-4 w-4 animate-spin" : "h-5 w-5 animate-spin"} /> : <Stethoscope className={size === "sm" ? "h-4 w-4" : "h-5 w-5"} />} {label}
    </button>
  );
}

/** Botón "Atender": abre la consulta de la cita en un clic. */
export function AttendButton({ appointmentId, label = "Atender", variant = "primary", size = "sm", className }: {
  appointmentId: string; label?: string; variant?: "primary" | "secondary" | "success"; size?: "sm" | "md"; className?: string;
}) {
  return (
    <form action={startConsultation.bind(null, appointmentId)} className="inline-flex">
      <Btn label={label} variant={variant} size={size} className={className} />
    </form>
  );
}
