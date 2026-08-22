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
  const [uom, setUom] = useState("kg");
  const [shelfLife, setShelfLife] = useState(0);
  const [shelfLifeUom, setShelfLifeUom] = useState("YEARS");

  const isRaw = type === "RAW";

  const handleTypeChange = (newType: string) => {
    setType(newType);
    if (newType === "RAW") {
      setShelfLife(0);
      setShelfLifeUom("YEARS");
    } else {
      if (shelfLife === 0) setShelfLife(1);
    }
  };

  const submit = (form: FormData) =>
    start(async () => {
      form.set("type", type);
      form.set("uom", uom);
      form.set("shelfLife", isRaw ? "0" : String(shelfLife));
      form.set("shelfLifeUom", isRaw ? "YEARS" : shelfLifeUom);

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
          <Field label="Material ID">
            <TextInput name="materialId" mono placeholder="PARA-500" required />
          </Field>
          <Field label="Type">
            <Select name="type" value={type} onChange={(e) => handleTypeChange(e.target.value)}>
              <option value="RAW">RAW</option>
              <option value="INTERMEDIATE">INTERMEDIATE</option>
              <option value="PRODUCT">PRODUCT</option>
            </Select>
          </Field>
          <Field label="Name" className="col-span-2">
            <TextInput name="name" placeholder="Paracetamol 500mg Tablet" required />
          </Field>
          <Field label="UOM">
            <TextInput
              name="uom"
              mono
              placeholder="kg"
              value={uom}
              onChange={(e) => setUom(e.target.value)}
              required
            />
          </Field>
          <Field label="Shelf life" hint={isRaw ? "RAW has no shelf life (0)" : "positive integer"}>
            <div className="flex gap-1.5">
              <TextInput
                name="shelfLife"
                type="number"
                mono
                value={isRaw ? 0 : shelfLife}
                onChange={(e) => setShelfLife(Number(e.target.value))}
                min={isRaw ? 0 : 1}
                disabled={isRaw}
              />
              <Select
                name="shelfLifeUom"
                className="w-auto"
                value={isRaw ? "YEARS" : shelfLifeUom}
                onChange={(e) => setShelfLifeUom(e.target.value)}
                disabled={isRaw}
              >
                <option value="YEARS">YEARS</option>
                <option value="MONTHS">MONTHS</option>
                <option value="DAYS">DAYS</option>
              </Select>
            </div>
          </Field>
        </div>
        <div className="flex flex-col gap-3.5 px-6 pb-[22px] pt-2">
          <div className="flex items-center gap-2.5 rounded-lg border border-[#ece0cc] bg-panel-2 px-[13px] py-2.5 text-[11.5px] text-amber-ink">
            <span className="h-2.5 w-2.5 flex-none rounded-[3px] bg-amber" />
            On save, an outbound sync is logged to <code className="font-mono">/api/v1/material/create</code>
          </div>
          <div className="flex justify-end gap-2.5">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Syncing…" : "Create & sync"}
            </Button>
          </div>
        </div>
      </form>
    </Modal>
  );
}
