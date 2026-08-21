import "server-only";
import type { ProcessOrderPayload, MaterialPayload } from "./types";

// The outbound Batchline client. In a real deployment these hit
// https://api.batchline.example/api/v1/*; here they are logged no-ops so the
// PoC runs offline. Returns a synthetic HTTP result the caller logs as an
// IntegrationMessage.
const API_KEY = process.env.BATCHLINE_API_KEY ?? "local-demo-key";

export interface SendResult {
  ok: boolean;
  httpStatus: number;
  endpoint: string;
  method: string;
  response: Record<string, unknown>;
}

export async function sendMaterial(p: MaterialPayload): Promise<SendResult> {
  return fakeCall("/api/v1/material/create", "POST", { key: API_KEY }, { material_id: p.material_id, status: "accepted" });
}

export async function sendOrder(p: ProcessOrderPayload): Promise<SendResult> {
  return fakeCall("/api/v1/processorder/create", "POST", { key: API_KEY }, { batch_id: p.batch_id, status: "planned" });
}

function fakeCall(
  endpoint: string,
  method: string,
  _headers: Record<string, string>,
  response: Record<string, unknown>,
): SendResult {
  // Simulate network latency + a stable "delivered" result.
  return { ok: true, httpStatus: endpoint.includes("create") ? 201 : 200, endpoint, method, response };
}
