"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** Vuelve a cargar los datos de la página cada cierto tiempo (y al volver a la pestaña), sin recargar el navegador. */
export function AutoRefresh({ seconds = 60 }: { seconds?: number }) {
  const router = useRouter();
  useEffect(() => {
    const t = setInterval(() => { if (document.visibilityState === "visible") router.refresh(); }, seconds * 1000);
    const onVis = () => { if (document.visibilityState === "visible") router.refresh(); };
    document.addEventListener("visibilitychange", onVis);
    return () => { clearInterval(t); document.removeEventListener("visibilitychange", onVis); };
  }, [router, seconds]);
  return null;
}
