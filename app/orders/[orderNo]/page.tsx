import { notFound } from "next/navigation";
import { getOrder, getEvents, getLatestOrderError } from "@/lib/data/orders";
import { getMaterials } from "@/lib/data/materials";
import { getLots } from "@/lib/data/lots";
import { getRecipes } from "@/lib/data/recipes";
import { OrderDetail } from "@/components/orders/OrderDetail";

export const dynamic = "force-dynamic";

export default async function OrderDrillDown({ params }: { params: Promise<{ orderNo: string }> }) {
  const { orderNo } = await params;
  const [order, events, lastError, materials, lots, recipes] = await Promise.all([
    getOrder(orderNo),
    getEvents(orderNo),
    getLatestOrderError(orderNo),
    getMaterials(),
    getLots(),
    getRecipes(),
  ]);
  if (!order) notFound();
  return (
    <OrderDetail
      order={order}
      initialEvents={events}
      lastError={lastError}
      materials={materials}
      lots={lots}
      recipes={recipes}
    />
  );
}
