import { notFound } from "next/navigation";
import { getOrder, getEvents } from "@/lib/data/orders";
import { OrderDetail } from "@/components/orders/OrderDetail";

export const dynamic = "force-dynamic";

export default async function OrderDrillDown({ params }: { params: Promise<{ orderNo: string }> }) {
  const { orderNo } = await params;
  const [order, events] = await Promise.all([getOrder(orderNo), getEvents(orderNo)]);
  if (!order) notFound();
  return <OrderDetail order={order} initialEvents={events} />;
}
