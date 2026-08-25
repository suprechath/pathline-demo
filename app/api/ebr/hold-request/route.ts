import { receiveHoldRequest } from "@/app/lims/actions";

// EBR → LIMS inbound: Batchline posts a hold-point test request here when a
// batch reaches an in-process control gate. Accepts either a spec_code or
// inline dynamic specification definition.
export async function POST(req: Request) {
  const body = (await req.json()) as {
    batch_id?: string;
    batchId?: string;
    stage_name?: string;
    stageName?: string;
    gate_step?: string;
    gateStep?: string;
    spec_code?: string;
    specCode?: string;
    request_ref?: string;
    ebr_request_ref?: string;
    ebrRequestRef?: string;
    specification?: {
      code?: string;
      test_name?: string;
      testName?: string;
      parameter?: string;
      limit_type?: "MAX" | "MIN" | "RANGE";
      limitType?: "MAX" | "MIN" | "RANGE";
      lower?: number | null;
      upper?: number | null;
      unit?: string;
      limit_text?: string;
      limitText?: string;
    };
    test_name?: string;
    testName?: string;
    parameter?: string;
    limit_type?: "MAX" | "MIN" | "RANGE";
    limitType?: "MAX" | "MIN" | "RANGE";
    lower?: number;
    upper?: number;
    unit?: string;
    limit_text?: string;
    limitText?: string;
  };

  const res = await receiveHoldRequest({
    batchId: body.batch_id ?? body.batchId ?? "BATCH-01",
    stageName: body.stage_name ?? body.stageName ?? "In-Process",
    gateStep: body.gate_step ?? body.gateStep,
    specCode: body.spec_code ?? body.specCode,
    specification: body.specification ?? (body.limit_type || body.limitType || body.lower != null || body.upper != null || body.test_name || body.testName || body.parameter ? {
      code: body.spec_code ?? body.specCode,
      test_name: body.test_name ?? body.testName,
      parameter: body.parameter,
      limit_type: body.limit_type ?? body.limitType,
      lower: body.lower,
      upper: body.upper,
      unit: body.unit,
      limit_text: body.limit_text ?? body.limitText,
    } : undefined),
    ebrRequestRef: body.request_ref ?? body.ebr_request_ref ?? body.ebrRequestRef,
  });

  if (!res.ok) return Response.json({ ok: false, error: res.message }, { status: 422 });
  return Response.json({ ok: true, sample_id: res.sampleId });
}
