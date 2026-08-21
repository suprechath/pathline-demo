"use client";
import { useState } from "react";
import Link from "next/link";
import type { RecipeVM } from "@/lib/data/recipes";
import type { MaterialVM } from "@/lib/domain/types";
import { Button } from "@/components/ui/Button";
import { RecipeForm } from "./RecipeForm";

export function RecipeDetail({ recipe, materials }: { recipe: RecipeVM; materials: MaterialVM[] }) {
  const [editOpen, setEditOpen] = useState(false);

  return (
    <div className="mx-auto max-w-[1000px]">
      <Link href="/recipes" className="mb-3.5 inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-amber-ink">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg>
        All recipes
      </Link>

      <div className="mb-[18px] rounded-[14px] border border-border bg-panel px-6 py-[22px] shadow-[0_1px_2px_rgba(74,50,34,.04)]">
        <div className="flex flex-wrap items-start justify-between gap-5">
          <div>
            <div className="mb-1.5 font-mono text-[21px] font-semibold text-espresso-deep">{recipe.recipeId}</div>
            <div className="text-[15px] font-medium text-ink">{recipe.product} <span className="font-mono text-[12px] font-normal text-faint">{recipe.productId}</span></div>
            {recipe.note && <div className="mt-1 text-[12.5px] text-muted">{recipe.note}</div>}
          </div>
          <Button variant="outline" onClick={() => setEditOpen(true)}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9" /><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4z" /></svg>
            Edit details
          </Button>
        </div>
        <div className="mt-5 grid grid-cols-2 gap-px overflow-hidden rounded-[10px] border border-line bg-line">
          <div className="bg-panel px-4 py-[13px]"><div className="mb-1 text-[10.5px] uppercase tracking-[.8px] text-faint">Base size</div><div className="font-mono text-[14px] font-semibold text-ink">{recipe.baseSize} {recipe.uom}</div></div>
          <div className="bg-panel px-4 py-[13px]"><div className="mb-1 text-[10.5px] uppercase tracking-[.8px] text-faint">Expected yield</div><div className="font-mono text-[14px] font-semibold text-ink">{recipe.yieldPct ?? "—"}%</div></div>
        </div>
      </div>

      {recipe.stages.map((s) => (
        <div key={s.id} className="mb-3.5 overflow-hidden rounded-[14px] border border-border bg-panel shadow-[0_1px_2px_rgba(74,50,34,.04)]">
          <div className="flex items-center gap-3 border-b border-line bg-[#faf6ee] px-5 py-[15px]">
            <span className="flex h-[26px] w-[26px] flex-none items-center justify-center rounded-lg bg-espresso font-mono text-[12px] font-semibold text-white">{s.seq}</span>
            <div className="flex-1">
              <div className="text-[14px] font-semibold text-ink">{s.name}</div>
              <div className="mt-px text-[11.5px] text-faint">produces <span className="font-semibold text-amber-ink">{s.output}</span> · <span className="font-mono">{s.outputQty} {s.uom}</span></div>
            </div>
            {s.subStages.length > 0 && (
              <div className="flex gap-1.5">
                {s.subStages.map((ss) => <span key={ss.seq} className="rounded-md bg-[#f0dcc0] px-2.5 py-1 text-[11px] font-semibold text-amber-deep">{ss.seq}. {ss.name}</span>)}
              </div>
            )}
          </div>
          <div className="px-5 pb-3.5 pt-1.5">
            <div className="flex justify-between py-2.5 text-[10.5px] font-semibold uppercase tracking-[.8px] text-[#93856f]"><span>BOM ID · material</span><span>Quantity</span></div>
            {s.bom.map((b) => (
              <div key={b.bomId} className="flex items-baseline justify-between gap-3 border-t border-[#f2ebdd] py-2.5">
                <div className="flex items-baseline gap-2.5"><span className="rounded-[5px] bg-panel-2 px-[7px] py-0.5 font-mono text-[11px] text-amber-ink">{b.bomId}</span><span className="text-[13px] text-ink">{b.material}</span> <span className="font-mono text-[11px] text-faint">{b.materialId}</span></div>
                <div className="font-mono text-[12.5px] text-ink">{b.qty} <span className="text-faint">{b.uom}</span></div>
              </div>
            ))}
            {s.bom.length === 0 && <div className="border-t border-[#f2ebdd] py-3 text-center text-[12px] text-faint">No BOM lines.</div>}
          </div>
        </div>
      ))}

      <RecipeForm open={editOpen} onClose={() => setEditOpen(false)} materials={materials} mode="edit" recipe={recipe} />
    </div>
  );
}
