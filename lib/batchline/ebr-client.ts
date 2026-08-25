import "server-only";

const BATCHLINE_API_KEY = process.env.BATCHLINE_API_KEY ?? "";
const BATCHLINE_INSTRUCTION_UPDATE_BASE_URL =
  process.env.BATCHLINE_INSTRUCTION_UPDATE_API_URL ??
  "https://batch-demo.bl-client.com/api/v1/batch/instruction/update";

import { formatBatchlineErrorDetail } from "./errors";

export interface EbrCall {
  endpoint: string;
  method: string;
  httpStatus: number;
  ref: string;
  ok: boolean;
  responseData?: unknown;
  errorDetail?: string;
}

export const extractEbrErrorDetail = formatBatchlineErrorDetail;

// Return a disposition and recorded measured value for a hold point back to Batchline EBR
// Endpoint: https://batch-demo.bl-client.com/api/v1/batch/instruction/update/[gate_step]
export async function returnDisposition(input: {
  batchId: string;
  sampleId: string;
  gateStep?: string | null;
  measuredValue: number | string;
  verdict: "PASS" | "OOS";
}): Promise<EbrCall> {
  const gateStep = input.gateStep || "1";
  const endpoint = `${BATCHLINE_INSTRUCTION_UPDATE_BASE_URL}/${encodeURIComponent(gateStep)}`;

  const payload = {
    batch_id: input.batchId,
    actual_result: [
      {
        repeat_no: 1, // always 1
        value: String(input.measuredValue),
        executed_user_email: "API@demo.com"
      },
    ],
  };

  let responseData: unknown = null;
  let responseStatus = 200;
  let isSuccess = false;
  let errorDetail: string | undefined;

  try {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        "x-api-key": BATCHLINE_API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
      cache: "no-store",
    });

    responseStatus = res.status;
    try {
      responseData = await res.json();
    } catch {
      responseData = { status: res.statusText };
    }
    console.log("responseData: ", responseData);
    isSuccess = res.ok;
    if (!res.ok) {
      errorDetail = extractEbrErrorDetail(responseData, responseStatus);
    }
  } catch (err) {
    console.error("Batchline EBR returnDisposition error:", err);
    responseStatus = 502;
    isSuccess = false;
    responseData = { status: "error", error: err instanceof Error ? err.message : String(err) };
    errorDetail = err instanceof Error ? err.message : String(err);
  }

  return {
    endpoint,
    method: "POST",
    httpStatus: responseStatus,
    ok: isSuccess,
    ref: `EBR-DISP-${input.sampleId}`,
    responseData,
    errorDetail,
  };
}
