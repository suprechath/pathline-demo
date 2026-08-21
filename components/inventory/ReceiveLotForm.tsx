"use client";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import type { MaterialVM } from "@/lib/domain/types";
import { receiveLot } from "@/app/inventory/actions";
import { Modal, ModalHeader } from "@/components/ui/Modal";
import { Field, TextInput, Select } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { toast } from "@/components/ui/Toast";

export function ReceiveLotForm({ open, onClose, materials }: { open: boolean; onClose: () => void; materials: MaterialVM[] }) {
  const [pending, start] = useTransition();
  const router = useRouter();

  const submit = (form: FormData) =>
    start(async () => {
      const res = await receiveLot(form);
      toast(res);
      if (res.ok) { onClose(); router.refresh(); }
    });

  return (
    <Modal open={open} onClose={onClose}>
      <ModalHeader title="Receive lot" onClose={onClose} />
      <form action={submit}>
        <div className="grid grid-cols-2 gap-[15px] px-6 py-[22px]">
          <Field label="Lot ID"><TextInput name="lotId" mono placeholder="LOT-API-2202" required /></Field>
          <Field label="Material">
            <Select name="materialId" required>
              {materials.map((m) => <option key={m.id} value={m.materialId}>{m.name} · {m.materialId}</option>)}
            </Select>
          </Field>
          <Field label="Quantity"><TextInput name="quantity" mono placeholder="500" required /></Field>
          <Field label="Location"><TextInput name="location" mono placeholder="WH-A / R05" /></Field>
          <Field label="Expiry" className="col-span-2"><TextInput name="expiry" mono placeholder="2028-03-01" /></Field>
        </div>
        <div className="flex flex-col gap-3.5 px-6 pb-[22px] pt-2">
          <div className="rounded-lg border border-[#ece0cc] bg-panel-2 px-[13px] py-2.5 text-[11.5px] text-muted">
            UOM is inherited from the selected material.
          </div>
          <div className="flex justify-end gap-2.5">
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={pending}>{pending ? "Receiving…" : "Receive lot"}</Button>
          </div>
        </div>
      </form>
    </Modal>
  );
}
