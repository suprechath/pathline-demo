"use client";
import { useState, useTransition, useEffect } from "react";
import { useRouter } from "next/navigation";
import type { MaterialVM } from "@/lib/domain/types";
import type { MaterialType, ShelfLifeUom } from "@prisma/client";
import { updateMaterial } from "@/app/materials/actions";
import { Field, TextInput, Select } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { toast } from "@/components/ui/Toast";

interface EditMaterialDrawerProps {
  material: MaterialVM | null;
  onClose: () => void;
}

export function EditMaterialDrawer({ material, onClose }: EditMaterialDrawerProps) {
  const [pending, start] = useTransition();
  const router = useRouter();

  const [name, setName] = useState("");
  const [type, setType] = useState<MaterialType>("RAW");
  const [uom, setUom] = useState("");
  const [shelfLife, setShelfLife] = useState<number>(0);
  const [shelfLifeUom, setShelfLifeUom] = useState<ShelfLifeUom>("YEARS");
  const [active, setActive] = useState(true);

  useEffect(() => {
    if (material) {
      setName(material.name);
      setType(material.type);
      setUom(material.uom);
      setShelfLife(material.shelfLife);
      setShelfLifeUom(material.shelfLifeUom);
      setActive(material.active);
    }
  }, [material]);

  useEffect(() => {
    if (!material) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [material, onClose]);

  if (!material) return null;

  const isRaw = type === "RAW";

  const handleSubmit = (form: FormData) =>
    start(async () => {
      form.set("materialId", material.materialId);
      form.set("name", name);
      form.set("type", type);
      form.set("uom", uom);
      form.set("shelfLife", isRaw ? "0" : String(shelfLife));
      form.set("shelfLifeUom", isRaw ? "YEARS" : shelfLifeUom);
      form.set("active", String(active));

      const res = await updateMaterial(form);
      toast(res);
      if (res.ok) {
        onClose();
        router.refresh();
      }
    });

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-[70] flex justify-end bg-[rgba(46,32,22,.4)] backdrop-blur-[2px]"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex h-full w-[440px] max-w-[94vw] flex-col bg-panel shadow-[-16px_0_44px_rgba(46,32,22,.25)]"
        style={{ animation: "drawerin .25s ease both" }}
      >
        {/* Header */}
        <div className="flex-none border-b border-line px-6 py-5">
          <div className="flex items-start justify-between">
            <div>
              <div className="text-[10.5px] font-semibold uppercase tracking-[0.8px] text-faint">
                EDIT MATERIAL
              </div>
              <h2 className="mt-1 font-mono text-[20px] font-bold text-espresso">
                {material.materialId}
              </h2>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-1 text-faint hover:text-ink"
              aria-label="Close"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Scrollable Form Body */}
        <form action={handleSubmit} className="flex flex-1 flex-col justify-between overflow-hidden">
          <div className="flex-1 overflow-y-auto px-6 py-5">
            <div className="flex flex-col gap-4">
              <Field label="Name">
                <TextInput
                  name="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Material name"
                  required
                />
              </Field>

              <Field label="Type">
                <Select
                  name="type"
                  value={type}
                  onChange={(e) => {
                    const newType = e.target.value as MaterialType;
                    setType(newType);
                    if (newType === "RAW") setShelfLife(0);
                    else if (shelfLife === 0) setShelfLife(1);
                  }}
                >
                  <option value="RAW">RAW</option>
                  <option value="INTERMEDIATE">INTERMEDIATE</option>
                  <option value="PRODUCT">PRODUCT</option>
                </Select>
              </Field>

              <Field label="UOM">
                <TextInput
                  name="uom"
                  value={uom}
                  onChange={(e) => setUom(e.target.value)}
                  placeholder="kg"
                  required
                />
              </Field>

              <Field label="Shelf life" hint={isRaw ? "RAW has no shelf life (0)" : "positive integer"}>
                <div className="flex gap-2">
                  <TextInput
                    type="number"
                    min={isRaw ? 0 : 1}
                    name="shelfLife"
                    value={isRaw ? 0 : shelfLife}
                    onChange={(e) => setShelfLife(Number(e.target.value))}
                    disabled={isRaw}
                    className="w-2/3"
                  />
                  <Select
                    name="shelfLifeUom"
                    value={isRaw ? "YEARS" : shelfLifeUom}
                    onChange={(e) => setShelfLifeUom(e.target.value as ShelfLifeUom)}
                    disabled={isRaw}
                    className="w-1/3"
                  >
                    <option value="YEARS">YEARS</option>
                    <option value="MONTHS">MONTHS</option>
                    <option value="DAYS">DAYS</option>
                    <option value="HOURS">HOURS</option>
                    <option value="MINUTES">MINUTES</option>
                  </Select>
                </div>
              </Field>

              {/* Active Toggle Card */}
              <div className="flex items-center justify-between rounded-xl border border-[#e8ddcb] bg-[#fbf6ed] p-3.5">
                <div>
                  <div className="text-[13px] font-semibold text-espresso">Active</div>
                  <div className="text-[11.5px] text-muted">Toggling is logged as a Batchline sync</div>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={active}
                  onClick={() => setActive(!active)}
                  className={`relative inline-flex h-6 w-11 flex-none cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                    active ? "bg-[#c59a68]" : "bg-[#d8ccb8]"
                  }`}
                >
                  <span
                    aria-hidden="true"
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                      active ? "translate-x-5" : "translate-x-0"
                    }`}
                  />
                </button>
              </div>

              {/* Sync Note Banner */}
              <div className="flex items-center gap-2.5 rounded-lg border border-[#e8ddcb] bg-[#fbf6ed] px-3.5 py-2.5 text-[12px] text-amber-ink">
                <span className="h-2.5 w-2.5 flex-none rounded-[3px] bg-amber" />
                <span>
                  Saving syncs to <code className="font-mono text-[11.5px]">/api/v1/material/update</code>
                </span>
              </div>
            </div>
          </div>

          {/* Footer Actions */}
          <div className="flex flex-none justify-end gap-2.5 border-t border-line bg-panel px-6 py-4">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Saving…" : "Save changes"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
