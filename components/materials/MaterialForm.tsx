"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createMaterial } from "@/app/materials/actions";
import { Modal, ModalHeader } from "@/components/ui/Modal";
import { Field, TextInput, Select } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { toast } from "@/components/ui/Toast";

export function MaterialForm({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [pending, start] = useTransition();
  const router = useRouter();
  const [type, setType] = useState("RAW");

  const submit = (form: FormData) =>
    start(async () => {
      const res = await createMaterial(form);
      toast(res);
      if (res.ok) {
        onClose();
        router.refresh();
      }
    });

  return (
    <Modal open={open} onClose={onClose}>
      <ModalHeader title="New material" onClose={onClose} />
      <form action={submit}>
        <div className="grid grid-cols-2 gap-[15px] px-6 py-[22px]">
          <Field label="Material ID"><TextInput name="materialId" mono placeholder="PARA-500" required /></Field>
          <Field label="Type">
            <Select name="type" value={type} onChange={(e) => setType(e.target.value)}>
              <option>RAW</option><option>INTERMEDIATE</option><option>PRODUCT</option>
            </Select>
          </Field>
          <Field label="Name" className="col-span-2"><TextInput name="name" placeholder="Paracetamol 500mg Tablet" required /></Field>
          <Field label="UOM"><TextInput name="uom" mono placeholder="kg" defaultValue="kg" required /></Field>
          <Field label="Shelf life" hint={type === "RAW" ? "RAW must be 0" : "positive integer"}>
            <div className="flex gap-1.5">
              <TextInput name="shelfLife" mono defaultValue="0" />
              <Select name="shelfLifeUom" className="w-auto"><option>YEARS</option><option>MONTHS</option><option>DAYS</option></Select>
            </div>
          </Field>
        </div>
        <div className="flex flex-col gap-3.5 px-6 pb-[22px] pt-2">
          <div className="flex items-center gap-2.5 rounded-lg border border-[#ece0cc] bg-panel-2 px-[13px] py-2.5 text-[11.5px] text-amber-ink">
            <span className="h-2.5 w-2.5 flex-none rounded-[3px] bg-amber" />
            On save, an outbound sync is logged to <code className="font-mono">/api/v1/material/create</code>
          </div>
          <div className="flex justify-end gap-2.5">
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={pending}>{pending ? "Syncing…" : "Create & sync"}</Button>
          </div>
        </div>
      </form>
    </Modal>
  );
}
