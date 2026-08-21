import { redirect } from "next/navigation";

// No dashboard — the demo opens straight on process orders.
export default function Home() {
  redirect("/materials");
}
