import { getOrders } from "@/lib/data/orders";
import { getAssignableMaterials } from "@/lib/data/materials";
import { getLots } from "@/lib/data/lots";
import { OrdersTable } from "@/components/orders/OrdersTable";
import { PageIntro } from "@/components/ui/PageIntro";

export const dynamic = "force-dynamic";

export default async function OrdersPage() {
  const [orders, materials, lots] = await Promise.all([
    getOrders(),
    getAssignableMaterials(),
    getLots(),
  ]);
  return (
    <div className="mx-auto max-w-[1080px]">
      <PageIntro>
        Process orders. Build an order, assign lots until the sum bar balances, then send to Batchline
        and watch execution return live in the drill-down.
      </PageIntro>
      <OrdersTable orders={orders} materials={materials} lots={lots} />
    </div>
  );
}
