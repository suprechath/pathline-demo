import "server-only";
import type { OrderVM } from "@/lib/domain/types";
import type { WebhookEvent } from "./types";

// Drives a fake batch: over several seconds it POSTs webhook-style events to
// the SAME inbound route the real Batchline system would call. This is the
// integration seam — everything downstream (webhook handler, DB writes, SSE)
// is the real path.
const BASE_URL = process.env.BASE_URL ?? "http://localhost:3000";
const API_KEY = process.env.BATCHLINE_API_KEY ?? "local-demo-key";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function buildBatchScript(o: OrderVM): Array<Omit<WebhookEvent, "batch_id" | "process_number">> {
  const [api, lact, mag] = o.bom;
  const lot = (b?: OrderVM["bom"][number]) => b?.lots[0]?.lotId ?? "LOT";
  return [
    { topic: "batch_status.update", seq: 1, title: "Batch started", detail: "Operator J. Okafor · vessel BL-300", batch_status: "STARTED", executed_user: "J. Okafor" },
    { topic: "instruction.updated", seq: 2, title: "Tare vessel", detail: "BL-300 zeroed before charge" },
    { topic: "instruction.updated", seq: 3, title: "Dispense Paracetamol API", actual_value: "149.4", target_value: api?.required ?? "150", uom: "kg", lot_ref: lot(api) },
    { topic: "instruction.updated", seq: 4, title: "Dispense Lactose Monohydrate", actual_value: "145.2", target_value: lact?.required ?? "145", uom: "kg", lot_ref: lot(lact) },
    { topic: "instruction.updated", seq: 5, title: "Dispense Magnesium Stearate", actual_value: "5.4", target_value: mag?.required ?? "5", uom: "kg", lot_ref: lot(mag), has_exception: true, exception_level: "Over tolerance", detail: "+0.4 kg over target · reviewed & accepted by QA (S. Meyer)" },
    { topic: "instruction.updated", seq: 6, title: "Blend 12 min @ 24 rpm", detail: "Homogeneity check passed" },
    { topic: "instruction.updated", seq: 7, title: "Verification signatures", detail: "Operator J. Okafor · QA S. Meyer" },
    { topic: "batch_status.update", seq: 8, title: "Batch completed", detail: "Yield recorded", batch_status: "COMPLETED", yield_actual: (Number(o.size) * 0.9937).toFixed(1) },
  ];
}

const DELAYS = [600, 900, 1200, 1200, 1400, 1200, 1100, 1000];

// Fire-and-forget from the Server Action. Not awaited so the UI returns
// immediately; the SSE stream picks up each event as the webhook writes it.
export async function runSimulation(order: OrderVM) {
  const script = buildBatchScript(order);
  for (let i = 0; i < script.length; i++) {
    await sleep(DELAYS[i] ?? 1000);
    const event: WebhookEvent = { ...script[i], batch_id: order.batchId ?? "", process_number: order.orderNo };
    try {
      await fetch(`${BASE_URL}/api/batchline/webhook`, {
        method: "POST",
        headers: { "content-type": "application/json", "x-api-key": API_KEY },
        body: JSON.stringify(event),
      });
    } catch (e) {
      // Real Batchline retries a failed webhook 5x/min; for the PoC we log & continue.
      console.error("[simulator] webhook post failed", e);
    }
  }
}
