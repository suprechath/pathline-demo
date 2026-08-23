"use client";
import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { MaterialVM, LotVM, OrderVM } from "@/lib/domain/types";
import type { RecipeVM } from "@/lib/data/recipes";
import { createAndSendOrderToBatchline, updateDraftOrder } from "@/app/orders/actions";
import { Modal, ModalHeader } from "@/components/ui/Modal";
import { Field, TextInput, Select } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { LotAssigner, getFefoLots, type WizLine } from "./LotAssigner";
import { toast } from "@/components/ui/Toast";

const STEPS = ["1. Order & Schedule", "2. Recipe & Batch Size", "3. Materials & Lots"];

const getTodayStr = () => {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
};

export function OrderWizard({
  open,
  onClose,
  materials,
  lots,
  recipes = [],
  initialOrder,
}: {
  open: boolean;
  onClose: () => void;
  materials: MaterialVM[];
  lots: LotVM[];
  recipes?: RecipeVM[];
  initialOrder?: OrderVM | null;
}) {
  const [step, setStep] = useState(1);
  const [pending, start] = useTransition();
  const router = useRouter();

  const todayStr = useMemo(() => getTodayStr(), []);

  // Helper to build initial form from props
  const buildInitialForm = () => {
    if (!initialOrder) {
      return {
        orderNo: "",
        recipeId: "",
        product: "",
        size: "",
        uom: "",
        planStart: "",
        planEnd: "",
        stageName: "",
      };
    }
    const matchedRecipe = recipes.find(
      (r) =>
        (initialOrder.erpRecipeId && r.recipeId.toLowerCase() === initialOrder.erpRecipeId.toLowerCase()) ||
        r.id === initialOrder.erpRecipeId ||
        r.productId === initialOrder.productId
    );
    return {
      orderNo: initialOrder.orderNo,
      recipeId: matchedRecipe?.recipeId ?? initialOrder.erpRecipeId ?? "",
      product: initialOrder.productId,
      size: initialOrder.size,
      uom: initialOrder.uom,
      planStart: initialOrder.planStart,
      planEnd: initialOrder.planEnd,
      stageName: initialOrder.stageName,
    };
  };

  // Helper to build initial BOM lines from props
  const buildInitialLines = (): WizLine[] => {
    if (!initialOrder) return [];

    const matchedRecipe = recipes.find(
      (r) =>
        (initialOrder.erpRecipeId && r.recipeId.toLowerCase() === initialOrder.erpRecipeId.toLowerCase()) ||
        r.id === initialOrder.erpRecipeId ||
        r.productId === initialOrder.productId
    );
    const baseSizeNum = Number(matchedRecipe?.baseSize) || Number(initialOrder.size) || 1;
    const currentSizeNum = Number(initialOrder.size) || baseSizeNum;
    const scale = baseSizeNum > 0 ? currentSizeNum / baseSizeNum : 1;

    return initialOrder.bom.map((b, idx) => {
      const baseQty = scale > 0 ? Number(b.required) / scale : Number(b.required);
      return {
        id: b.id || `line-${idx}`,
        bomId: b.bomId,
        material: b.material,
        materialId: b.materialId,
        baseQty: baseQty || Number(b.required),
        required: Number(b.required),
        uom: b.uom,
        stageName: initialOrder.stageName,
        allocations:
          b.lots.length > 0
            ? b.lots.map((l) => ({ lotId: l.lotId, assigned: String(l.quantity) }))
            : [{ lotId: "", assigned: "0" }],
      };
    });
  };

  const [form, setForm] = useState(buildInitialForm);
  const [lines, setLines] = useState<WizLine[]>(buildInitialLines);

  // Sync state whenever open/initialOrder/recipes changes
  useEffect(() => {
    if (open) {
      setStep(1);
      if (initialOrder) {
        setForm(buildInitialForm());
        setLines(buildInitialLines());
      } else {
        reset();
      }
    }
  }, [open, initialOrder, recipes]);

  const selectRecipe = (recipeId: string) => {
    const r = recipes.find((x) => x.recipeId === recipeId);
    if (!r) return;

    // Aggregate BOM lines across all stages of the recipe with initial 1x standard scaling
    const newLines: WizLine[] = [];
    r.stages.forEach((st) => {
      st.bom.forEach((b, bIdx) => {
        const baseQty = Number(b.qty) || 0;
        const fefoLots = getFefoLots(b.materialId, lots);
        const availLot = fefoLots[0];
        newLines.push({
          id: `${st.seq}-${bIdx}-${b.bomId}`,
          bomId: b.bomId,
          material: b.material,
          materialId: b.materialId,
          baseQty,
          required: baseQty,
          uom: b.uom,
          stageName: st.name,
          allocations: [{ lotId: availLot ? availLot.lotId : "", assigned: "0" }],
        });
      });
    });

    setForm((prev) => ({
      ...prev,
      recipeId: r.recipeId,
      product: r.productId,
      size: r.baseSize, // Reset to selected recipe standard base size
      uom: r.uom,
      stageName: r.stages[0]?.name ?? "Manufacturing",
    }));
    setLines(newLines);
  };

  const handleSizeChange = (newSizeStr: string) => {
    setForm((prev) => ({ ...prev, size: newSizeStr }));
    const selectedRecipe = recipes.find((r) => r.recipeId === form.recipeId);
    const baseSizeNum = Number(selectedRecipe?.baseSize) || 1;
    const newSizeNum = Number(newSizeStr) || 0;
    const scale = newSizeNum > 0 && baseSizeNum > 0 ? newSizeNum / baseSizeNum : 1;

    setLines((prev) =>
      prev.map((l) => {
        const required = Math.round(l.baseQty * scale * 1000) / 1000;
        return {
          ...l,
          required,
          allocations: l.allocations.map((a) => ({ ...a, assigned: "0" })), // reset assigned on size change
        };
      })
    );
  };

  const setField = (k: keyof typeof form) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => setForm((f) => ({ ...f, [k]: e.target.value }));

  // Date validation rules
  const isPlanStartPresent = Boolean(form.planStart);
  const isPlanStartFuture = initialOrder ? Boolean(form.planStart) : form.planStart >= todayStr;
  const isPlanEndPresent = Boolean(form.planEnd);
  const isPlanEndAfterStart = form.planEnd >= form.planStart;

  const planStartError =
    form.planStart && !isPlanStartFuture
      ? "Plan start must be today or in the future"
      : null;

  const planEndError =
    form.planEnd && form.planStart && !isPlanEndAfterStart
      ? "Plan end must be on or after plan start"
      : null;

  const isStep1Valid =
    form.orderNo.trim().length > 0 &&
    form.recipeId !== "" &&
    isPlanStartPresent &&
    isPlanStartFuture &&
    isPlanEndPresent &&
    isPlanEndAfterStart;

  const isStep2Valid = Number(form.size) > 0 && lines.length > 0;

  const balanced = useMemo(
    () =>
      lines.length > 0 &&
      lines.every((l) => {
        const total = l.allocations.reduce((sum, a) => sum + (Number(a.assigned) || 0), 0);
        return (
          Math.abs(total - l.required) < 1e-6 &&
          l.allocations.length > 0 &&
          l.allocations.every((a) => a.lotId !== "" && Number(a.assigned) > 0)
        );
      }),
    [lines]
  );

  const selectedRecipe = recipes.find((r) => r.recipeId === form.recipeId);

  const reset = () => {
    setStep(1);
    setForm({
      orderNo: "",
      recipeId: "",
      product: "",
      size: "",
      uom: "",
      planStart: "",
      planEnd: "",
      stageName: "",
    });
    setLines([]);
  };

  const close = () => {
    onClose();
    reset();
  };

  const create = () =>
    start(async () => {
      const payload = {
        orderNo: form.orderNo.trim(),
        productMaterialId: form.product,
        recipeId: form.recipeId,
        size: Number(form.size),
        uom: form.uom,
        planStart: form.planStart,
        planEnd: form.planEnd,
        stageName: form.stageName,
        lines: lines.map((l) => ({
          bomId: l.bomId,
          materialId: l.materialId,
          required: l.required,
          lots: l.allocations
            .filter((a) => a.lotId && Number(a.assigned) > 0)
            .map((a) => ({ lotId: a.lotId, quantity: Number(a.assigned) })),
        })),
      };

      const res = initialOrder
        ? await updateDraftOrder(payload)
        : await createAndSendOrderToBatchline(payload);

      toast(res);
      if (res.orderNo) {
        close();
        router.push(`/orders/${res.orderNo}`);
        router.refresh();
      }
    });

  return (
    <Modal open={open} onClose={() => {}} width={740}>
      <ModalHeader
        title={initialOrder ? `Edit Process Order — ${initialOrder.orderNo}` : "New Process Order Wizard"}
        onClose={close}
      />

      {/* Edit Mode Notice Banner */}
      {initialOrder && (
        <div className="mx-6 mt-3 flex items-center justify-between rounded-xl border border-[#ecd8c0] bg-[#faf3ea] px-4 py-2.5 text-[13px] text-[#5c3e21]">
          <div className="flex items-center gap-2.5">
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#b87333] text-[11px] font-bold text-white">✎</span>
            <span>Editing Draft Order <strong className="font-mono text-espresso-deep">{initialOrder.orderNo}</strong> ({initialOrder.product})</span>
          </div>
          <span className="rounded bg-[#f0e2cf] px-2 py-0.5 font-mono text-[11px] font-bold text-amber-ink">DRAFT MODE</span>
        </div>
      )}

      {/* Step Indicator */}
      <div className="flex gap-2.5 border-b border-[#f0e8dc] px-6 pb-3 pt-3">
        {STEPS.map((label, i) => {
          const n = i + 1;
          const isActive = step === n;
          const isDone = step > n;
          return (
            <div key={label} className="flex flex-1 items-center gap-2.5">
              <span
                className="flex h-[26px] w-[26px] flex-none items-center justify-center rounded-full text-[12px] font-bold transition-colors"
                style={{
                  background: isActive ? "#b87333" : isDone ? "#7d9540" : "#ece4d6",
                  color: isActive || isDone ? "#fff" : "#93856f",
                }}
              >
                {isDone ? "✓" : n}
              </span>
              <span
                className="text-[12.5px] font-semibold"
                style={{ color: isActive ? "#2e2016" : isDone ? "#4b6422" : "#a3927a" }}
              >
                {label}
              </span>
            </div>
          );
        })}
      </div>

      <div className="h-[500px] overflow-y-auto px-6 pb-3 pt-4">
        {/* STEP 1: Order Name, Recipe Selection & Schedule */}
        {step === 1 && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              {/* Order Name */}
              <Field label="Order Number">
                <TextInput
                  mono
                  value={form.orderNo}
                  onChange={setField("orderNo")}
                  readOnly={Boolean(initialOrder)}
                  placeholder="e.g. PO-2043"
                />
              </Field>

              {/* Recipe Selection */}
              <Field label="Master Recipe">
                <Select
                  value={form.recipeId}
                  onChange={(e) => selectRecipe(e.target.value)}
                >
                  <option value="" disabled>Select a Master Recipe…</option>
                  {recipes.map((r) => (
                    <option key={r.id} value={r.recipeId}>
                      {r.recipeId} · {r.product} (v{r.version} - {r.baseSize} {r.uom})
                    </option>
                  ))}
                  {form.recipeId && !recipes.some((r) => r.recipeId === form.recipeId) && (
                    <option value={form.recipeId}>{form.recipeId}</option>
                  )}
                </Select>
              </Field>
            </div>

            {/* Plan Dates Calendar Selection */}
            <div className="rounded-xl border border-[#ecd8c0] bg-[#fdfaf5] p-4">
              <div className="mb-2.5 flex items-center justify-between">
                <span className="text-[13px] font-semibold text-espresso-deep">Production Schedule</span>
                <span className="text-[11.5px] text-muted">Pick dates from the calendar</span>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1 block text-[11px] font-semibold uppercase tracking-[.6px] text-muted">
                    Plan Start Date
                  </label>
                  <input
                    type="date"
                    min={initialOrder ? undefined : todayStr}
                    value={form.planStart}
                    onChange={setField("planStart")}
                    placeholder="YYYY-MM-DD"
                    className="w-full rounded-lg border border-[#d8ccb8] bg-white px-3 py-2 text-[13px] font-mono text-ink focus:border-amber focus:outline-none"
                  />
                  {planStartError && (
                    <p className="mt-1 text-[11.5px] font-medium text-red-600">{planStartError}</p>
                  )}
                </div>

                <div>
                  <label className="mb-1 block text-[11px] font-semibold uppercase tracking-[.6px] text-muted">
                    Plan End Date
                  </label>
                  <input
                    type="date"
                    min={form.planStart || (initialOrder ? undefined : todayStr)}
                    value={form.planEnd}
                    onChange={setField("planEnd")}
                    placeholder="YYYY-MM-DD"
                    className="w-full rounded-lg border border-[#d8ccb8] bg-white px-3 py-2 text-[13px] font-mono text-ink focus:border-amber focus:outline-none"
                  />
                  {planEndError && (
                    <p className="mt-1 text-[11.5px] font-medium text-red-600">{planEndError}</p>
                  )}
                </div>
              </div>
            </div>

            {/* Pre-select Info Preview */}
            {(selectedRecipe || initialOrder) && (
              <div className="rounded-xl border border-line bg-panel-2 p-3.5 text-[12px] text-muted">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-espresso">Target Product: </span>
                  <strong className="text-ink">{selectedRecipe?.product || initialOrder?.product}</strong>
                  <span className="font-mono text-faint">({selectedRecipe?.productId || initialOrder?.productId})</span>
                </div>
                {selectedRecipe && (
                  <>
                    <div className="mt-1"> Standard Base Size: <span className="font-mono font-semibold text-amber-ink">{selectedRecipe.baseSize} {selectedRecipe.uom}</span></div>
                    <div> Stages: <span className="font-mono font-semibold text-espresso">{selectedRecipe.stages.length}</span></div>
                  </>
                )}
                <div> BOM items configured: <span className="font-mono font-semibold text-espresso">{lines.length}</span></div>
              </div>
            )}
          </div>
        )}

        {/* STEP 2: Recipe Review & Batch Size */}
        {step === 2 && (
          <div className="space-y-5">
            <div className="grid grid-cols-2 gap-4">
              <Field label="Target Batch Size">
                <div className="flex gap-2">
                  <TextInput
                    type="number"
                    mono
                    value={form.size}
                    onChange={(e) => handleSizeChange(e.target.value)}
                    placeholder="2000"
                  />
                  <div className="flex items-center rounded-lg border border-line bg-panel-2 px-3 font-mono text-[13px] font-semibold text-espresso">
                    {form.uom || "kg"}
                  </div>
                </div>
              </Field>

              <Field label="Process Stage Name">
                <TextInput
                  value={form.stageName}
                  onChange={setField("stageName")}
                  placeholder="e.g. Granulation & Blending"
                />
              </Field>
            </div>

            {/* Recipe Details Table with Scaled Quantities */}
            <div className="overflow-hidden rounded-xl border border-line">
              <div className="flex items-center justify-between bg-[#f5ede0] px-4 py-2.5 text-[12px] font-semibold text-espresso-deep">
                <span>Stage BOM Formulation Preview</span>
                <span className="font-mono text-[11px] font-normal text-muted">
                  Auto-scaled to {form.size || 0} {form.uom}
                </span>
              </div>
              <table className="w-full text-left text-[12.5px]">
                <thead className="border-b border-line bg-panel-2 font-mono text-[11px] uppercase tracking-wider text-muted">
                  <tr>
                    <th className="px-4 py-2">BOM ID</th>
                    <th className="px-4 py-2">Material</th>
                    <th className="px-4 py-2 text-right">Required Quantity</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {lines.map((l) => (
                    <tr key={l.id} className="hover:bg-panel-2/50">
                      <td className="px-4 py-2.5 font-mono text-[11.5px] font-semibold text-amber-ink">
                        {l.bomId}
                      </td>
                      <td className="px-4 py-2.5 text-ink font-medium">
                        {l.material} <span className="font-mono text-[11px] text-faint">({l.materialId})</span>
                      </td>
                      <td className="px-4 py-2.5 text-right font-mono font-semibold text-espresso">
                        {l.required} {l.uom}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* STEP 3: Lot Assignment */}
        {step === 3 && (
          <LotAssigner
            lines={lines}
            lots={lots}
            onChange={setLines}
            balanced={balanced}
          />
        )}
      </div>

      {/* Footer Navigation */}
      <div className="flex items-center justify-between border-t border-line px-6 pb-4 pt-3.5">
        <Button
          variant="outline"
          onClick={() => setStep((s) => s - 1)}
          style={{ visibility: step > 1 ? "visible" : "hidden" }}
        >
          Back
        </Button>

        <div className="flex gap-2.5">
          <Button variant="ghost" onClick={close}>
            Cancel
          </Button>

          {step === 1 && (
            <Button disabled={!isStep1Valid} onClick={() => setStep(2)}>
              Next: Review Recipe & Size ➔
            </Button>
          )}

          {step === 2 && (
            <Button disabled={!isStep2Valid} onClick={() => setStep(3)}>
              Next: Assign Lots ➔
            </Button>
          )}

          {step === 3 && (
            <Button
              variant="batchline"
              disabled={!balanced || pending}
              onClick={create}
            >
              {pending
                ? initialOrder
                  ? "Saving Changes & Sending…"
                  : "Creating & Sending…"
                : initialOrder
                  ? "Save Changes & Send to Batchline"
                  : "Create & Send to Batchline"}
            </Button>
          )}
        </div>
      </div>
    </Modal>
  );
}
