"use client";
import type { OrderVM } from "@/lib/domain/types";
import { buildOrderPayload } from "@/lib/batchline/payloads";
import { Modal, ModalHeader } from "@/components/ui/Modal";

export function PayloadPeek({ open, onClose, order }: { open: boolean; onClose: () => void; order: OrderVM }) {
  const text = JSON.stringify(buildOrderPayload(order), null, 2);
  return (
    <Modal open={open} onClose={onClose} width={560} dark>
      <ModalHeader
        dark
        onClose={onClose}
        title={
          <span className="flex items-center gap-2.5">
            <span className="h-2.5 w-2.5 rounded-[3px] bg-amber" />
            <span className="font-mono text-[13.5px] font-semibold text-[#f2e6d4]">POST /api/v1/processorder/create</span>
          </span>
        }
      />
      <pre className="m-0 max-h-[520px] overflow-auto whitespace-pre-wrap break-words px-[22px] py-5 font-mono text-[12px] leading-[1.65] text-[#e4d6c0]">{text}</pre>
      <div className="flex items-center gap-2 border-t border-[#4a3626] px-[22px] py-3 text-[11px] text-[#9a8a6f]">
        <span className="font-mono text-amber">x-api-key</span> local-demo-key · retry 5×/min on failure
      </div>
    </Modal>
  );
}
