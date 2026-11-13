import { addDays } from "@/lib/utils";

export type Lot = { id: string; quantity: number; expires_on: string | null; lot_number: string | null };

export function stockInfo(lots: Lot[], min: number, today: string) {
  const usable = lots.filter((l) => Number(l.quantity) > 0);
  const total = usable.reduce((a, l) => a + Number(l.quantity), 0);
  const expired = usable.filter((l) => l.expires_on && l.expires_on < today).reduce((a, l) => a + Number(l.quantity), 0);
  const soon = usable.filter((l) => l.expires_on && l.expires_on >= today && l.expires_on <= addDays(today, 60));
  const next = usable.map((l) => l.expires_on).filter(Boolean).sort()[0] as string | undefined;
  const status: { label: string; tone: "red" | "amber" | "green" | "violet" } =
    total === 0 ? { label: "Sin stock", tone: "red" }
      : total - expired <= Number(min) ? { label: "Stock bajo", tone: "amber" }
        : expired > 0 ? { label: "Con vencidos", tone: "red" }
          : soon.length ? { label: "Por vencer", tone: "violet" }
            : { label: "OK", tone: "green" };
  return { total, available: total - expired, expired, soonCount: soon.length, next, status };
}
