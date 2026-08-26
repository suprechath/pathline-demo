import { receiveHoldRequests, type HoldRequestInput } from "@/app/lims/actions";

// EBR → LIMS inbound: Batchline posts hold-point test request(s) here when a
// batch reaches one or more in-process control gates. Accepts:
// 1. Single object: { batch_id: "...", gate_step: "..." }
// 2. Direct array: [ { batch_id: "...", gate_step: "..." }, ... ]
// 3. Object with nested list: { batch_id: "...", hold_points: [ { gate_step: "..." } ] }
export async function POST(req: Request) {
  let body: any;
  try {
    body = await req.json();
  } catch {
    return Response.json({ ok: false, error: "Invalid JSON payload" }, { status: 400 });
  }

  // Normalize incoming payload into an array of hold requests
  let rawItems: any[] = [];
  let isSingle = false;

  if (Array.isArray(body)) {
    rawItems = body;
  } else if (
    body &&
    typeof body === "object" &&
    (Array.isArray(body.hold_points) ||
      Array.isArray(body.holdPoints) ||
      Array.isArray(body.requests) ||
      Array.isArray(body.items) ||
      Array.isArray(body.gate_steps) ||
      Array.isArray(body.gateSteps))
  ) {
    const list =
      body.hold_points ??
      body.holdPoints ??
      body.requests ??
      body.items ??
      body.gate_steps ??
      body.gateSteps;
    rawItems = list.map((item: any) => ({
      batch_id: item.batch_id ?? item.batchId ?? body.batch_id ?? body.batchId,
      stage_name: item.stage_name ?? item.stageName ?? body.stage_name ?? body.stageName,
      request_ref: item.request_ref ?? item.ebr_request_ref ?? item.ebrRequestRef ?? body.request_ref ?? body.ebr_request_ref ?? body.ebrRequestRef,
      ...item,
    }));
  } else if (body && typeof body === "object") {
    rawItems = [body];
    isSingle = true;
  }

  if (rawItems.length === 0) {
    return Response.json({ ok: false, error: "No hold point requests provided in payload" }, { status: 400 });
  }

  const inputs: HoldRequestInput[] = rawItems.map((item) => ({
    batchId: item.batch_id ?? item.batchId ?? "BATCH-01",
    stageName: item.stage_name ?? item.stageName ?? "In-Process",
    gateStep: item.gate_step ?? item.gateStep,
    specCode: item.spec_code ?? item.specCode,
    specification:
      item.specification ??
      (item.limit_type ||
      item.limitType ||
      item.lower != null ||
      item.upper != null ||
      item.test_name ||
      item.testName ||
      item.parameter ||
      item.options ||
      item.expected_value ||
      item.expectedValue
        ? {
            code: item.spec_code ?? item.specCode,
            test_name: item.test_name ?? item.testName,
            parameter: item.parameter,
            limit_type: item.limit_type ?? item.limitType,
            lower: item.lower,
            upper: item.upper,
            unit: item.unit,
            limit_text: item.limit_text ?? item.limitText,
            options: item.options,
            expected_value: item.expected_value ?? item.expectedValue,
          }
        : undefined),
    ebrRequestRef: item.request_ref ?? item.ebr_request_ref ?? item.ebrRequestRef,
  }));

  const res = await receiveHoldRequests(inputs);

  if (!res.ok) {
    return Response.json({ ok: false, error: res.message }, { status: 422 });
  }

  const firstSampleId = res.sampleIds?.[0];

  if (isSingle) {
    return Response.json({
      ok: true,
      sample_id: firstSampleId,
      sample_ids: res.sampleIds,
    });
  }

  return Response.json({
    ok: true,
    count: res.sampleIds?.length ?? 0,
    sample_id: firstSampleId,
    sample_ids: res.sampleIds,
    results: res.results,
  });
}
