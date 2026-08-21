"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { LotVM } from "@/lib/domain/types";
import { issueStock } from "@/app/inventory/actions";
import { Modal, ModalHeader } from "@/components/ui/Modal";
import { Field, TextInput, Select } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { toast } from "@/components/ui/Toast";

const REASONS = ["Sale / Dispatch", "QC sample", "Scrap / Write-off", "Rejection", "Adjustment", "Quarantine", "QC release"];

export function IssueStockForm({ open, onClose, lot }: { open: boolean; onClose: () => void; lot: LotVM | null }) {
  const [pending, start] = useTransition();
  const router = useRouter();
  const [reason, setReason] = useState("Sale / Dispatch");
  const [qty, setQty] = useState("");
  const [note, setNote] = useState("");
  if (!lot) return null;

  const max = Number(lot.quantity);
  const locked = reason === "Rejection" || reason === "Quarantine" || reason === "QC release";
  const effQty = reason === "Rejection" || reason === "Quarantine" ? max : reason === "QC release" ? max : Number(qty);

  const submit = () =>
    start(async () => {
      const res = await issueStock({ lotId: lot.lotId, reason, qty: Number(qty), note });
      toast(res);
      if (res.ok) { onClose(); router.refresh(); }
    });

  return (
    <Modal open={open} onClose={onClose}>
      <ModalHeader title={`Issue stock · ${lot.lotId}`} onClose={onClose} />
      <div className="flex flex-col gap-4 px-6 py-[22px]">
        <div className="flex items-center justify-between rounded-[10px] border border-[#ece0cc] bg-panel-2 px-[15px] py-3 text-[12px] text-muted">
          <span>On hand</span><span className="font-mono text-[15px] font-semibold text-espresso-deep">{lot.quantity} {lot.uom}</span>
        </div>
        <Field label="Reason">
          <Select value={reason} onChange={(e) => setReason(e.target.value)}>{REASONS.map((r) => <option key={r}>{r}</option>)}</Select>
        </Field>
        <Field label="Quantity to issue" hint={locked ? `Fixed for this reason (${reason === "QC release" ? "full quarantined" : "entire on-hand"}).` : `Capped at ${lot.quantity} ${lot.uom}.`}>
          <div className="flex gap-1.5">
            <TextInput mono value={locked ? String(effQty) : qty} onChange={(e) => setQty(e.target.value)} disabled={locked} placeholder="0" />
            <span className="flex items-center px-2.5 font-mono text-[12px] text-faint">{lot.uom}</span>
          </div>
        </Field>
        <Field label="Destination / note"><TextInput value={note} onChange={(e) => setNote(e.target.value)} placeholder="Customer, scrap location, or free text" /></Field>
        <div className="flex items-start gap-2.5 rounded-lg border border-[#ece0cc] bg-panel-2 px-[13px] py-2.5 text-[11.5px] text-muted">
          <span className="mt-0.5 h-2.5 w-2.5 flex-none rounded-[3px] bg-amber" />
          Confirming writes a signed movement and recomputes on-hand. Reaching zero marks the lot Consumed.
        </div>
      </div>
      <div className="flex justify-end gap-2.5 border-t border-line px-6 pb-5 pt-3.5">
        <Button variant="outline" onClick={onClose}>Cancel</Button>
        <Button variant="batchline" disabled={pending} onClick={submit}>{pending ? "Issuing…" : "Confirm issue"}</Button>
      </div>
    </Modal>
  );
}
