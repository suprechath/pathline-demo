"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { MaterialVM } from "@/lib/domain/types";
import { toggleActive } from "@/app/materials/actions";
import { Table, Th, Td } from "@/components/ui/Table";
import { Pill, TypeTag } from "@/components/ui/Pill";
import { Button } from "@/components/ui/Button";
import { MaterialForm } from "./MaterialForm";
import { toast } from "@/components/ui/Toast";

export function MaterialsTable({ materials }: { materials: MaterialVM[] }) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const router = useRouter();

  const onToggle = (materialId: string) =>
    start(async () => {
      const res = await toggleActive(materialId);
      toast(res);
      router.refresh();
    });

  return (
    <>
      <div className="mb-3 flex justify-end">
        <Button onClick={() => setOpen(true)}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
          New material
        </Button>
      </div>

      <Table>
        <thead>
          <tr>
            <Th>Material ID</Th><Th>Name</Th><Th>Type</Th><Th>UOM</Th><Th>Shelf life</Th><Th>Status</Th><Th right />
          </tr>
        </thead>
        <tbody>
          {materials.map((m) => (
            <tr key={m.id} style={{ background: m.active ? undefined : "#faf6ee" }}>
              <Td mono className="font-semibold text-espresso">{m.materialId}</Td>
              <Td className="text-ink">{m.name}</Td>
              <Td><TypeTag type={m.type} /></Td>
              <Td mono className="text-muted">{m.uom}</Td>
              <Td className="text-muted">{m.shelfLifeLabel}</Td>
              <Td><Pill status={m.active ? "ACTIVE" : "INACTIVE"} /></Td>
              <Td right>
                <button
                  disabled={pending}
                  onClick={() => onToggle(m.materialId)}
                  className="rounded-md border border-[#e0d3bf] px-3 py-1.5 text-[12px] font-semibold text-amber-ink hover:bg-panel-2 disabled:opacity-50"
                >
                  {m.active ? "Deactivate" : "Activate"}
                </button>
              </Td>
            </tr>
          ))}
        </tbody>
      </Table>

      <MaterialForm open={open} onClose={() => setOpen(false)} />
    </>
  );
}
