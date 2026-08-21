import { getHoldPoints, limsStats } from "@/lib/data/lims";
import { HoldsBoard } from "@/components/lims/HoldsBoard";

export const dynamic = "force-dynamic";

export default async function LimsPage() {
  const [holds, stats] = await Promise.all([getHoldPoints(), limsStats()]);
  return <HoldsBoard holds={holds} stats={stats} />;
}
