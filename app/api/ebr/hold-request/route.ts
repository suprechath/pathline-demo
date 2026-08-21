import { receiveHoldRequest } from "@/app/lims/actions";

// EBR → LIMS inbound: Batchline posts a hold-point test request here when a
// batch reaches an in-process control gate. Body is opaque EBR context; the
// LIMS assigns a sample id and returns it for the handshake.
export async function POST(req: Request) {
  const body = (await req.json()) as {
    batch_id: string;
    stage_name: string;
    gate_step?: string;
    spec_code: string;
    request_ref?: string;
  };

  const res = await receiveHoldRequest({
    batchId: body.batch_id,
    stageName: body.stage_name,
    gateStep: body.gate_step,
    specCode: body.spec_code,
    ebrRequestRef: body.request_ref,
  });

  if (!res.ok) return Response.json({ ok: false, error: res.message }, { status: 422 });
  return Response.json({ ok: true, sample_id: res.sampleId });
}
