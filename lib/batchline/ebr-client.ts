import "server-only";

// Thin stub of the Batchline EBR endpoints the LIMS talks to. In a real
// deployment these are network calls to the EBR; here they resolve locally so
// the demo runs on one machine. Each returns the wire metadata the LIMS logs.

export interface EbrCall {
  endpoint: string;
  method: string;
  httpStatus: number;
  ref: string;
}

// Return a disposition (pass/fail) for a hold point back to the EBR, which
// then unblocks or halts the batch at the hold point.
export async function returnDisposition(input: {
  batchId: string;
  sampleId: string;
  verdict: "PASS" | "OOS";
}): Promise<EbrCall> {
  return {
    endpoint: "/ebr/v1/holdpoint/disposition",
    method: "POST",
    httpStatus: 200,
    ref: `EBR-DISP-${input.sampleId}`,
  };
}
