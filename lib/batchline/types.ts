// The wire contract between Pathline and Batchline — payload shapes going
// out and webhook event shapes coming back. This is the ONLY simulated seam.

export interface ProcessOrderPayload {
  process_number: string;
  product_spec: string | null;
  batch_id: string;
  message_mode: "EBR_CENTRIC" | "RECIPE_NO_LOTS" | "RECIPE_WITH_LOTS";
  size: { value: string; uom: string };
  plan: { start: string; end: string };
  stages: {
    name: string;
    target_material: string;
    target_size: string;
    bom: {
      variable: string;
      material: string;
      required: { value: string; uom: string };
      lots: { lot_id: string; quantity: string }[];
    }[];
  }[];
}

export interface MaterialPayload {
  material_id: string;
  name: string;
  type: "RAW" | "INTERMEDIATE" | "PRODUCT";
  uom: string;
  shelf_life: { value: number; uom: string };
  active: boolean;
}

// Inbound webhook envelope (Batchline -> Pathline).
export type WebhookTopic = "batch_status.update" | "instruction.updated";

export interface WebhookEvent {
  topic: WebhookTopic;
  batch_id: string;
  process_number: string;
  seq: number;
  title: string;
  detail?: string;
  batch_status?: "STARTED" | "COMPLETED" | "CANCELLED";
  actual_value?: string;
  target_value?: string;
  uom?: string;
  lot_ref?: string;
  has_exception?: boolean;
  exception_level?: string;
  executed_user?: string;
  yield_actual?: string;
}
