import { guard } from "@/lib/context";
import { Phase2 } from "@/components/layout/phase2";

export default async function Page() {
  await guard("farmacia");
  return <Phase2 module="farmacia" />;
}
