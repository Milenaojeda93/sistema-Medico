import { Tabs } from "@/components/ui";

export function BillingTabs({ active }: { active: "particular" | "aseguradoras" }) {
  return <Tabs active={active} tabs={[{ key: "particular", label: "Facturas y cobros", href: "/facturacion" }, { key: "aseguradoras", label: "Facturación a aseguradoras", href: "/facturacion/aseguradoras" }]} />;
}
