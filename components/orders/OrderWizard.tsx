"use client";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { MaterialVM, LotVM } from "@/lib/domain/types";
import { createOrder, sendToBatchline } from "@/app/orders/actions";
import { Modal, ModalHeader } from "@/components/ui/Modal";
import { Field, TextInput, Select } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { LotAssigner, type WizLine } from "./LotAssigner";
import { toast } from "@/components/ui/Toast";

const STEPS = ["Order", "Stage", "Materials & lots"];

const DEFAULT_LINES: WizLine[] = [
  { id: "l1", bomId: "BOM-API-PARA", material: "Paracetamol API", materialId: "PARA-API", required: 150, uom: "kg", lotId: "LOT-API-2201", assigned: "0" },
  { id: "l2", bomId: "BOM-LACT", material: "Lactose Monohydrate", materialId: "LACT-MONO", required: 145, uom: "kg", lotId: "LOT-LACT-0091", assigned: "0" },
  { id: "l3", bomId: "BOM-MAG", material: "Magnesium Stearate", materialId: "MAG-STE", required: 5, uom: "kg", lotId: "LOT-MAG-0442", assigned: "0" },
];

export function OrderWizard({ open, onClose, materials }: { open: boolean; onClose: () => void; materials: MaterialVM[]; lots: LotVM[] }) {
  const [step, setStep] = useState(1);
  const [pending, start] = useTransition();
  const router = useRouter();
  const [form, setForm] = useState({
    orderNo: "PO-2043", product: "PARA-BLEND", size: "300", uom: "kg",
    planStart: "2026-08-20", planEnd: "2026-08-21", stageName: "Blending",
  });
  const [lines, setLines] = useState<WizLine[]>(DEFAULT_LINES);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const balanced = useMemo(() => lines.every((l) => Math.abs(Number(l.assigned) - l.required) < 1e-6), [lines]);
  const products = materials.filter((m) => m.type === "PRODUCT" || m.type === "INTERMEDIATE");
  const productName = products.find((p) => p.materialId === form.product)?.name ?? "Paracetamol Blend";

  const reset = () => { setStep(1); setLines(DEFAULT_LINES); };
  const close = () => { onClose(); reset(); };

  const create = () =>
    start(async () => {
      const res = await createOrder({
        orderNo: form.orderNo, productMaterialId: form.product, size: Number(form.size), uom: form.uom,
        planStart: form.planStart, planEnd: form.planEnd, stageName: form.stageName,
        lines: lines.map((l) => ({ bomId: l.bomId, materialId: l.materialId, required: l.required, lots: [{ lotId: l.lotId, quantity: Number(l.assigned) }] })),
      });
      toast(res);
      if (!res.ok) return;
      const send = await sendToBatchline(form.orderNo);
      toast(send);
      close();
      router.push(`/orders/${form.orderNo}`);
    });

  return (
    <Modal open={open} onClose={close} width={660}>
      <ModalHeader title="New process order" onClose={close} />

      <div className="flex gap-2.5 px-6 pb-1 pt-4">
        {STEPS.map((label, i) => {
          const n = i + 1;
          return (
            <div key={label} className="flex flex-1 items-center gap-2.5">
              <span
                className="flex h-[26px] w-[26px] flex-none items-center justify-center rounded-full text-[12px] font-bold"
                style={{ background: step === n ? "#b87333" : step > n ? "#7d9540" : "#ece4d6", color: step >= n ? "#fff" : "#93856f" }}
              >{n}</span>
              <span className="text-[12.5px] font-semibold" style={{ color: step === n ? "#2e2016" : "#a3927a" }}>{label}</span>
            </div>
          );
        })}
      </div>

      <div className="min-h-[264px] px-6 pb-1.5 pt-4">
        {step === 1 && (
          <div className="grid grid-cols-2 gap-[15px]">
            <Field label="Product (Product / Intermediate)" className="col-span-2">
              <Select value={form.product} onChange={set("product")}>
                {products.map((p) => <option key={p.id} value={p.materialId}>{p.name} · {p.materialId}</option>)}
              </Select>
            </Field>
            <Field label="Order number"><TextInput mono value={form.orderNo} onChange={set("orderNo")} /></Field>
            <Field label="Size">
              <div className="flex gap-1.5">
                <TextInput mono value={form.size} onChange={set("size")} />
                <TextInput mono value={form.uom} onChange={set("uom")} className="w-16" />
              </div>
            </Field>
            <Field label="Plan start"><TextInput mono value={form.planStart} onChange={set("planStart")} /></Field>
            <Field label="Plan end"><TextInput mono value={form.planEnd} onChange={set("planEnd")} /></Field>
          </div>
        )}

        {step === 2 && (
          <div className="grid grid-cols-2 gap-[15px]">
            <Field label="Stage name" className="col-span-2"><TextInput value={form.stageName} onChange={set("stageName")} /></Field>
            <Field label="Target material">
              <Select value={form.product} onChange={set("product")}>
                {products.map((p) => <option key={p.id} value={p.materialId}>{p.name} · {p.materialId}</option>)}
              </Select>
            </Field>
            <Field label="Target size">
              <div className="flex gap-1.5"><TextInput mono value={form.size} onChange={set("size")} /><span className="flex items-center px-2.5 font-mono text-[12px] text-faint">{form.uom}</span></div>
            </Field>
            <div className="col-span-2 mt-0.5 rounded-lg border border-[#ece0cc] bg-panel-2 px-[13px] py-[11px] text-[12px] text-muted">
              One stage for this PoC. Batchline maps process → stage → BOM → lot.
            </div>
          </div>
        )}

        {step === 3 && <LotAssigner lines={lines} onChange={setLines} balanced={balanced} />}
      </div>

      <div className="flex items-center justify-between border-t border-line px-6 pb-5 pt-3.5">
        <Button variant="outline" onClick={() => setStep((s) => s - 1)} style={{ visibility: step > 1 ? "visible" : "hidden" }}>Back</Button>
        <div className="flex gap-2.5">
          <Button variant="ghost" onClick={close}>Cancel</Button>
          {step < 3 ? (
            <Button onClick={() => setStep((s) => s + 1)}>Next</Button>
          ) : (
            <Button variant="batchline" disabled={!balanced || pending} onClick={create}>{pending ? "Sending…" : "Create & send"}</Button>
          )}
        </div>
      </div>
    </Modal>
  );
}
