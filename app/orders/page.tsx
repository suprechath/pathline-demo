import { getOrders } from "@/lib/data/orders";
import { getAssignableMaterials } from "@/lib/data/materials";
import { getLots } from "@/lib/data/lots";
import { getRecipes } from "@/lib/data/recipes";
import { OrdersTable } from "@/components/orders/OrdersTable";

export const dynamic = "force-dynamic";

export default async function OrdersPage() {
  const [orders, materials, lots, recipes] = await Promise.all([
    getOrders(),
    getAssignableMaterials(),
    getLots(),
    getRecipes(),
  ]);
  return (
    <div className="mx-auto max-w-[1080px]">
      <OrdersTable orders={orders} materials={materials} lots={lots} recipes={recipes} />
    </div>
  );
}

