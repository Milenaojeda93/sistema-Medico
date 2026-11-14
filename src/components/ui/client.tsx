"use client";

import { createContext, useActionState, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";
import { X, Loader2 } from "lucide-react";
import { btnClass, type BtnVariant } from "@/components/ui";
import { cn } from "@/lib/utils";

export type ActionState = { ok?: boolean; error?: string; message?: string } | null;
export type FormAction = (prev: ActionState, fd: FormData) => Promise<ActionState>;

const ModalCtx = createContext<{ close: () => void } | null>(null);

export function SubmitButton({ children, variant = "primary", size = "md", className, confirm, name, value, disabled }: { children: ReactNode; variant?: BtnVariant; size?: "sm" | "md"; className?: string; confirm?: string; name?: string; value?: string; disabled?: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      name={name}
      value={value}
      disabled={pending || disabled}
      className={cn(btnClass(variant, size), className)}
      onClick={(e) => {
        if (confirm && !window.confirm(confirm)) e.preventDefault();
      }}
    >
      {pending && <Loader2 className="h-4 w-4 animate-spin" />}
      {children}
    </button>
  );
}

export function ActionForm({ action, children, className, resetOnSuccess = false, successMessage }: { action: FormAction; children: ReactNode; className?: string; resetOnSuccess?: boolean; successMessage?: string }) {
  const [state, formAction] = useActionState(action, null);
  const modal = useContext(ModalCtx);
  const router = useRouter();
  const ref = useRef<HTMLFormElement>(null);
  const errRef = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    if (state?.error) errRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    if (state?.ok) {
      if (resetOnSuccess) ref.current?.reset();
      modal?.close();
      router.refresh();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  return (
    <form ref={ref} action={formAction} className={className}>
      {children}
      {state?.error && <p ref={errRef} className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 ring-1 ring-red-100">{state.error}</p>}
      {state?.ok && (state.message || successMessage) && !modal && (
        <p className="mt-3 rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700 ring-1 ring-green-100">{state.message || successMessage}</p>
      )}
    </form>
  );
}

export function Modal({ trigger, title, children, size = "md", triggerVariant = "primary", triggerSize = "md", triggerClassName }: { trigger: ReactNode; title: string; children: ReactNode; size?: "sm" | "md" | "lg" | "xl"; triggerVariant?: BtnVariant; triggerSize?: "sm" | "md"; triggerClassName?: string }) {
  const ref = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);
  const close = () => {
    ref.current?.close();
    setOpen(false);
  };
  const width = { sm: "max-w-md", md: "max-w-xl", lg: "max-w-3xl", xl: "max-w-5xl" }[size];
  return (
    <>
      <button
        type="button"
        className={cn(btnClass(triggerVariant, triggerSize), triggerClassName)}
        onClick={() => {
          setOpen(true);
          ref.current?.showModal();
        }}
      >
        {trigger}
      </button>
      <dialog ref={ref} onClose={() => setOpen(false)} className={cn("m-auto w-[calc(100%-2rem)] rounded-2xl bg-white p-0 shadow-2xl", width)}>
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3.5">
          <h3 className="text-base font-semibold text-slate-900">{title}</h3>
          <button type="button" onClick={close} className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600" aria-label="Cerrar">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="max-h-[75vh] overflow-y-auto px-5 py-4">{open && <ModalCtx.Provider value={{ close }}>{children}</ModalCtx.Provider>}</div>
      </dialog>
    </>
  );
}

export function ActionButton({ action, children, variant = "secondary", size = "sm", confirm, fields }: { action: FormAction; children: ReactNode; variant?: BtnVariant; size?: "sm" | "md"; confirm?: string; fields?: Record<string, string> }) {
  const [state, formAction] = useActionState(action, null);
  const router = useRouter();
  useEffect(() => {
    if (state?.ok) router.refresh();
    if (state?.error) alert(state.error);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);
  return (
    <form action={formAction} className="inline">
      {fields && Object.entries(fields).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
      <SubmitButton variant={variant} size={size} confirm={confirm}>
        {children}
      </SubmitButton>
    </form>
  );
}

export function PrintButton({ label = "Imprimir" }: { label?: string }) {
  return <button type="button" onClick={() => window.print()} className={btnClass("secondary")}>{label}</button>;
}
