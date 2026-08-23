"use client";
import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { RecipeVM } from "@/lib/data/recipes";
import type { MaterialVM } from "@/lib/domain/types";
import { Button } from "@/components/ui/Button";
import { toast } from "@/components/ui/Toast";
import { updateRecipeStages } from "@/app/recipes/actions";
import { RecipeForm } from "./RecipeForm";

interface DraftStage {
  name: string;
  seq: number;
  output: string;
  outputId: string;
  outputQty: string | number;
  uom: string;
  subStages: { name: string; seq: number }[];
  bom: {
    bomId: string;
    material: string;
    materialId: string;
    qty: string | number;
    uom: string;
  }[];
}

export function RecipeDetail({ recipe, materials }: { recipe: RecipeVM; materials: MaterialVM[] }) {
  const [editOpen, setEditOpen] = useState(false);
  const [isDesigning, setIsDesigning] = useState(false);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const outputMaterials = materials.filter((m) => m.type === "PRODUCT" || m.type === "INTERMEDIATE");

  const [draftStages, setDraftStages] = useState<DraftStage[]>(() =>
    recipe.stages.map((s) => ({
      name: s.name,
      seq: s.seq,
      output: s.output,
      outputId: s.outputId,
      outputQty: s.outputQty,
      uom: s.uom,
      subStages: s.subStages.map((ss) => ({ ...ss })),
      bom: s.bom.map((b) => ({ ...b })),
    }))
  );

  const handleStartDesigning = () => {
    setDraftStages(
      recipe.stages.map((s) => ({
        name: s.name,
        seq: s.seq,
        output: s.output,
        outputId: s.outputId,
        outputQty: s.outputQty,
        uom: s.uom,
        subStages: s.subStages.map((ss) => ({ ...ss })),
        bom: s.bom.map((b) => ({ ...b })),
      }))
    );
    setIsDesigning(true);
  };

  const handleCancelDesigning = () => {
    setDraftStages(
      recipe.stages.map((s) => ({
        name: s.name,
        seq: s.seq,
        output: s.output,
        outputId: s.outputId,
        outputQty: s.outputQty,
        uom: s.uom,
        subStages: s.subStages.map((ss) => ({ ...ss })),
        bom: s.bom.map((b) => ({ ...b })),
      }))
    );
    setIsDesigning(false);
  };

  const handleSaveStages = () => {
    // Validate draft stages
    for (const [idx, s] of draftStages.entries()) {
      if (!s.name.trim()) {
        toast({ ok: false, message: `Stage ${idx + 1} name cannot be empty`, system: "pathline" });
        return;
      }
      if (!s.outputId) {
        toast({ ok: false, message: `Stage ${idx + 1} must produce an output material`, system: "pathline" });
        return;
      }
    }

    startTransition(async () => {
      const res = await updateRecipeStages({
        recipeId: recipe.recipeId,
        stages: draftStages.map((s, idx) => ({
          name: s.name.trim(),
          seq: idx + 1,
          outputMaterialId: s.outputId,
          outputQty: Number(s.outputQty) || 0,
          uom: s.uom,
          subStages: s.subStages.map((ss, sIdx) => ({
            name: ss.name.trim(),
            seq: sIdx + 1,
          })),
          bom: s.bom.map((b) => ({
            bomId: b.bomId.trim(),
            materialId: b.materialId,
            qty: Number(b.qty) || 0,
            uom: b.uom,
          })),
        })),
      });

      toast(res);
      if (res.ok) {
        setIsDesigning(false);
        router.refresh();
      }
    });
  };

  const updateStage = (stageIndex: number, patch: Partial<DraftStage>) => {
    setDraftStages((prev) => {
      const next = [...prev];
      next[stageIndex] = { ...next[stageIndex], ...patch };
      return next;
    });
  };

  const handleOutputMaterialChange = (stageIndex: number, materialId: string) => {
    const mat = materials.find((m) => m.materialId === materialId);
    updateStage(stageIndex, {
      outputId: materialId,
      output: mat?.name ?? "",
      uom: mat?.uom ?? draftStages[stageIndex].uom,
    });
  };

  const addStage = () => {
    const nextSeq = draftStages.length + 1;
    const defaultProduct =
      outputMaterials.find((m) => m.materialId === recipe.productId) || outputMaterials[0] || materials[0];
    setDraftStages((prev) => [
      ...prev,
      {
        name: `Stage ${nextSeq}`,
        seq: nextSeq,
        output: defaultProduct?.name ?? "",
        outputId: defaultProduct?.materialId ?? "",
        outputQty: recipe.baseSize || "100",
        uom: defaultProduct?.uom ?? recipe.uom,
        subStages: [],
        bom: [],
      },
    ]);
  };

  const deleteStage = (stageIndex: number) => {
    if (draftStages.length <= 1) {
      toast({ ok: false, message: "A recipe must have at least one stage", system: "pathline" });
      return;
    }
    setDraftStages((prev) =>
      prev.filter((_, i) => i !== stageIndex).map((s, idx) => ({ ...s, seq: idx + 1 }))
    );
  };

  const addSubStage = (stageIndex: number) => {
    const stage = draftStages[stageIndex];
    const nextSeq = stage.subStages.length + 1;
    updateStage(stageIndex, {
      subStages: [...stage.subStages, { seq: nextSeq, name: `Step ${nextSeq}` }],
    });
  };

  const updateSubStage = (stageIndex: number, subIndex: number, name: string) => {
    const stage = draftStages[stageIndex];
    const nextSub = [...stage.subStages];
    nextSub[subIndex] = { ...nextSub[subIndex], name };
    updateStage(stageIndex, { subStages: nextSub });
  };

  const deleteSubStage = (stageIndex: number, subIndex: number) => {
    const stage = draftStages[stageIndex];
    const nextSub = stage.subStages
      .filter((_, i) => i !== subIndex)
      .map((ss, idx) => ({ ...ss, seq: idx + 1 }));
    updateStage(stageIndex, { subStages: nextSub });
  };

  const addBomLine = (stageIndex: number) => {
    const stage = draftStages[stageIndex];
    const nextNum = stage.bom.length + 1;
    const defaultMat = materials[0];
    const prefix = recipe.recipeId.replace("RCP-", "");
    const stageCode = stage.seq === 1 ? "G" : stage.seq === 2 ? "C" : `S${stage.seq}`;
    const defaultBomId = `BOM-${prefix}-${stageCode}${String(nextNum).padStart(2, "0")}`;
    updateStage(stageIndex, {
      bom: [
        ...stage.bom,
        {
          bomId: defaultBomId,
          material: defaultMat?.name ?? "",
          materialId: defaultMat?.materialId ?? "",
          qty: "1",
          uom: defaultMat?.uom ?? "kg",
        },
      ],
    });
  };

  const updateBomLine = (
    stageIndex: number,
    bomIndex: number,
    field: "bomId" | "qty",
    value: string
  ) => {
    const stage = draftStages[stageIndex];
    const nextBom = [...stage.bom];
    nextBom[bomIndex] = { ...nextBom[bomIndex], [field]: value };
    updateStage(stageIndex, { bom: nextBom });
  };

  const updateBomMaterial = (stageIndex: number, bomIndex: number, materialId: string) => {
    const stage = draftStages[stageIndex];
    const mat = materials.find((m) => m.materialId === materialId);
    const nextBom = [...stage.bom];
    nextBom[bomIndex] = {
      ...nextBom[bomIndex],
      materialId,
      material: mat?.name ?? "",
      uom: mat?.uom ?? nextBom[bomIndex].uom,
    };
    updateStage(stageIndex, { bom: nextBom });
  };

  const deleteBomLine = (stageIndex: number, bomIndex: number) => {
    const stage = draftStages[stageIndex];
    const nextBom = stage.bom.filter((_, i) => i !== bomIndex);
    updateStage(stageIndex, { bom: nextBom });
  };

  const totalBomLines = isDesigning
    ? draftStages.reduce((acc, s) => acc + s.bom.length, 0)
    : recipe.bomCount;

  return (
    <div className="mx-auto max-w-[1020px]">
      <Link href="/recipes" className="mb-3.5 inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-amber-ink hover:underline">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round">
          <path d="M15 18l-6-6 6-6" />
        </svg>
        All recipes
      </Link>

      {/* Main Header Card */}
      <div className="mb-[18px] rounded-[14px] border border-border bg-panel px-6 py-[22px] shadow-[0_1px_2px_rgba(74,50,34,.04)]">
        <div className="flex flex-wrap items-start justify-between gap-5">
          <div>
            <div className="mb-1.5 flex items-center gap-2.5">
              <span className="font-mono text-[21px] font-semibold text-espresso-deep">{recipe.recipeId}</span>
              <span className="rounded bg-panel-2 px-2 py-0.5 font-mono text-[11.5px] font-bold text-amber-ink">
                v{recipe.version}
              </span>
              <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-[11px] font-bold text-emerald-800">
                {recipe.status}
              </span>
            </div>
            <div className="text-[15px] font-semibold text-ink">
              {recipe.product} <span className="font-mono text-[12px] font-normal text-faint">({recipe.productId})</span>
            </div>
            {recipe.note && <div className="mt-1 text-[12.5px] text-muted">{recipe.note}</div>}
          </div>

          <div className="flex items-center gap-2.5">
            {!isDesigning ? (
              <>
                <Button variant="outline" onClick={() => setEditOpen(true)}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 20h9" />
                    <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4z" />
                  </svg>
                  Edit details
                </Button>
                <Button className="bg-[#a35e23] hover:bg-[#8e501b] text-white" onClick={handleStartDesigning}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3 3v18h18" />
                    <path d="m19 9-5 5-4-4-3 3" />
                  </svg>
                  Design stages
                </Button>
              </>
            ) : (
              <>
                <Button variant="outline" onClick={handleCancelDesigning}>
                  Cancel
                </Button>
                <Button disabled={pending} className="bg-[#486321] hover:bg-[#3d541c] text-white" onClick={handleSaveStages}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20 6L9 17l-5-5" />
                  </svg>
                  {pending ? "Saving…" : "Save changes"}
                </Button>
              </>
            )}
          </div>
        </div>

        {/* 4-Item Stat Metric Bar */}
        <div className="mt-5 grid grid-cols-4 gap-px overflow-hidden rounded-[10px] border border-line bg-line">
          <div className="bg-panel px-4 py-[13px]">
            <div className="mb-1 text-[10.5px] font-semibold uppercase tracking-[.8px] text-faint">Base size</div>
            <div className="font-mono text-[14px] font-semibold text-ink">{recipe.baseSize} {recipe.uom}</div>
          </div>
          <div className="bg-panel px-4 py-[13px]">
            <div className="mb-1 text-[10.5px] font-semibold uppercase tracking-[.8px] text-faint">Expected yield</div>
            <div className="font-mono text-[14px] font-semibold text-ink">{recipe.yieldPct ?? "—"}%</div>
          </div>
          <div className="bg-panel px-4 py-[13px]">
            <div className="mb-1 text-[10.5px] font-semibold uppercase tracking-[.8px] text-faint">Stages</div>
            <div className="font-mono text-[14px] font-semibold text-ink">{isDesigning ? draftStages.length : recipe.stageCount}</div>
          </div>
          <div className="bg-panel px-4 py-[13px]">
            <div className="mb-1 text-[10.5px] font-semibold uppercase tracking-[.8px] text-faint">Total BOM lines</div>
            <div className="font-mono text-[14px] font-semibold text-ink">{totalBomLines}</div>
          </div>
        </div>
      </div>

      {/* Render Read-Only View */}
      {!isDesigning && (
        <>
          {recipe.stages.map((s) => (
            <div key={s.id} className="mb-3.5 overflow-hidden rounded-[14px] border border-border bg-panel shadow-[0_1px_2px_rgba(74,50,34,.04)]">
              <div className="flex items-center gap-3 border-b border-line bg-[#faf6ee] px-5 py-[15px]">
                <span className="flex h-[26px] w-[26px] flex-none items-center justify-center rounded-lg bg-espresso font-mono text-[12px] font-semibold text-white">
                  {s.seq}
                </span>
                <div className="flex-1">
                  <div className="text-[14px] font-semibold text-ink">{s.name}</div>
                  <div className="mt-px text-[11.5px] text-faint">
                    produces <span className="font-semibold text-amber-ink">{s.output}</span> · <span className="font-mono">{s.outputQty} {s.uom}</span>
                  </div>
                </div>
                {s.subStages.length > 0 && (
                  <div className="flex gap-1.5">
                    {s.subStages.map((ss) => (
                      <span key={ss.seq} className="rounded-md bg-[#f0dcc0] px-2.5 py-1 text-[11px] font-semibold text-amber-deep">
                        {ss.seq}. {ss.name}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              <div className="px-5 pb-3.5 pt-1.5">
                <div className="flex items-center gap-2.5 py-2.5 text-[10.5px] font-semibold uppercase tracking-[.8px] text-[#93856f]">
                  <span className="w-[140px] ml-1 flex-shrink-0 font-bold">eBR BOM ID</span>
                  <span className="flex-1 min-w-0 font-bold">Assigned material</span>
                  <span className="w-[210px] flex-shrink-0 text-right font-bold pr-16">Quantity</span>
                </div>
                {s.bom.map((b) => (
                  <div key={b.bomId} className="flex items-center gap-2.5 border-t border-[#f2ebdd] py-2.5">
                    <span className="w-[140px] rounded-[5px] bg-panel-2 px-[7px] py-0.5 font-mono text-[11.5px] font-semibold text-amber-ink flex-shrink-0">
                      {b.bomId}
                    </span>
                    <div className="flex-1 min-w-0 truncate">
                      <span className="text-[13px] font-semibold text-ink">{b.material}</span>{" "}
                      <span className="font-mono text-[11px] text-faint">({b.materialId})</span>
                    </div>
                    <div className="w-[210px] flex-shrink-0 text-right font-mono text-[12.5px] font-semibold text-espresso pr-16">
                      {b.qty} <span className="font-normal text-muted">{b.uom}</span>
                    </div>
                  </div>
                ))}
                {s.bom.length === 0 && <div className="border-t border-[#f2ebdd] py-3 text-center text-[12px] text-faint">No BOM lines.</div>}
              </div>
            </div>
          ))}
        </>
      )}

      {/* Render Design Stages Editable Mode */}
      {isDesigning && (
        <>
          {draftStages.map((s, sIndex) => (
            <div key={sIndex} className="mb-3.5 overflow-hidden rounded-[14px] border border-border bg-panel shadow-[0_1px_2px_rgba(74,50,34,.04)]">
              {/* Stage Header Controls */}
              <div className="flex items-center gap-2.5 border-b border-line bg-[#faf6ee] px-5 py-[13px]">
                <span className="flex h-[26px] w-[26px] flex-none items-center justify-center rounded-lg bg-espresso font-mono text-[12px] font-semibold text-white">
                  {s.seq}
                </span>
                <input
                  value={s.name}
                  onChange={(e) => updateStage(sIndex, { name: e.target.value })}
                  placeholder="Stage name"
                  className="w-[150px] flex-shrink-0 rounded-lg border border-[#d8ccb8] bg-panel px-3 py-1.5 text-[13px] font-semibold text-ink placeholder:text-faint focus:border-amber focus:outline-none"
                />
                <span className="flex-shrink-0 text-[12px] text-faint">produces</span>
                <select
                  value={s.outputId}
                  onChange={(e) => handleOutputMaterialChange(sIndex, e.target.value)}
                  className="flex-1 min-w-0 truncate rounded-lg border border-[#d8ccb8] bg-panel px-2.5 py-1.5 text-[12.5px] font-medium text-ink focus:border-amber focus:outline-none"
                >
                  {outputMaterials.map((m) => (
                    <option key={m.id} value={m.materialId}>
                      {m.name} · {m.materialId}
                    </option>
                  ))}
                </select>
                <input
                  type="number"
                  step="any"
                  value={s.outputQty}
                  onChange={(e) => updateStage(sIndex, { outputQty: e.target.value })}
                  className="w-[75px] flex-shrink-0 rounded-lg border border-[#d8ccb8] bg-panel px-2 py-1.5 font-mono text-[12.5px] text-ink focus:border-amber focus:outline-none text-right"
                />
                <span className="flex-shrink-0 font-mono text-[12px] text-muted">{s.uom}</span>

                {/* Right-aligned frozen action buttons */}
                <div className="ml-auto flex flex-shrink-0 items-center gap-2">
                  <button
                    type="button"
                    onClick={() => addSubStage(sIndex)}
                    className="inline-flex items-center gap-1 rounded-md border border-[#d8ccb8] bg-panel px-2.5 py-1.5 text-[11.5px] font-semibold text-ink hover:bg-panel-2 focus:outline-none transition-colors"
                  >
                    + Sub-stage
                  </button>
                  <button
                    type="button"
                    onClick={() => deleteStage(sIndex)}
                    title="Delete stage"
                    className="rounded-md border border-[#e8dcd0] p-1.5 text-muted hover:border-red-300 hover:bg-red-50 hover:text-red-600 focus:outline-none transition-colors"
                  >
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                      <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                    </svg>
                  </button>
                </div>
              </div>

              {/* Sub-stages */}
              {s.subStages.length > 0 && (
                <div className="flex flex-wrap items-center gap-2 border-b border-[#f2ebdd] bg-[#faf6ee] px-5 pb-3 pt-0.5">
                  {s.subStages.map((ss, ssIndex) => (
                    <div
                      key={ssIndex}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-[#e2d2be] bg-[#f0dcc0] px-2.5 py-1 text-[11.5px] font-semibold text-amber-deep"
                    >
                      <span className="font-mono text-[11px] opacity-75">{ss.seq}</span>
                      <input
                        value={ss.name}
                        onChange={(e) => updateSubStage(sIndex, ssIndex, e.target.value)}
                        className="w-[90px] bg-transparent font-semibold text-amber-deep placeholder:text-amber-deep/50 focus:outline-none"
                        placeholder="Step name"
                      />
                      <button
                        type="button"
                        onClick={() => deleteSubStage(sIndex, ssIndex)}
                        className="text-amber-deep opacity-60 hover:opacity-100 hover:text-red-700 focus:outline-none"
                      >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round">
                          <path d="M18 6L6 18M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* BOM Lines */}
              <div className="px-5 pb-3.5 pt-1.5">
                <div className="flex items-center gap-2.5 py-2 text-[10.5px] font-semibold uppercase tracking-[.8px] text-[#93856f]">
                  <span className="w-[140px] ml-1 flex-shrink-0 font-bold text-[#93856f]">eBR BOM ID</span>
                  <span className="flex-1 min-w-0 truncate font-bold text-[#93856f]">Assigned material</span>
                  <span className="w-[210px] flex-shrink-0 text-left font-bold text-[#93856f] pr-16">Quantity</span>
                </div>
                {s.bom.map((b, bIndex) => (
                  <div key={bIndex} className="flex items-center gap-2.5 border-t border-[#f2ebdd] py-2">
                    <input
                      value={b.bomId}
                      onChange={(e) => updateBomLine(sIndex, bIndex, "bomId", e.target.value)}
                      placeholder="BOM ID"
                      className="w-[140px] flex-shrink-0 rounded-lg border border-[#d8ccb8] bg-panel px-2.5 py-1.5 font-mono text-[12px] font-semibold text-amber-ink placeholder:text-faint focus:border-amber focus:outline-none"
                    />
                    <select
                      value={b.materialId}
                      onChange={(e) => updateBomMaterial(sIndex, bIndex, e.target.value)}
                      className="flex-1 min-w-0 truncate rounded-lg border border-[#d8ccb8] bg-panel px-3 py-1.5 text-[12.5px] text-ink focus:border-amber focus:outline-none"
                    >
                      {materials.map((m) => (
                        <option key={m.id} value={m.materialId}>
                          {m.name} · {m.materialId}
                        </option>
                      ))}
                    </select>
                    <div className="flex w-[210px] flex-shrink-0 items-center justify-end gap-2">
                      <input
                        type="number"
                        step="any"
                        value={b.qty}
                        onChange={(e) => updateBomLine(sIndex, bIndex, "qty", e.target.value)}
                        className="w-[100px] flex-shrink-0 rounded-lg border border-[#d8ccb8] bg-panel px-2.5 py-1.5 font-mono text-[12.5px] text-ink focus:border-amber focus:outline-none text-right"
                      />
                      <span className="flex-shrink-0 font-mono text-[12px] text-muted text-left min-w-[70px]">{b.uom}</span>
                      <button
                        type="button"
                        onClick={() => deleteBomLine(sIndex, bIndex)}
                        title="Remove BOM line"
                        className="flex-shrink-0 rounded-md border border-red-400 p-1.5 text-red-600 hover:border-red-400 hover:bg-red-500 hover:text-red-50 focus:outline-none transition-colors"
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round">
                          <path d="M18 6L6 18M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  </div>
                ))}
                {s.bom.length === 0 && (
                  <div className="border-t border-[#f2ebdd] py-2.5 text-center text-[12px] text-faint">No BOM lines.</div>
                )}
                <button
                  type="button"
                  onClick={() => addBomLine(sIndex)}
                  className="mt-2.5 flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-[#d8ccb8] bg-[#fdfbf7] py-2 text-[12px] font-semibold text-amber-ink hover:border-amber hover:bg-[#faf5ec] transition-colors focus:outline-none"
                >
                  + Add BOM line
                </button>
              </div>
            </div>
          ))}

          <div className="mt-3.5">
            <button
              type="button"
              onClick={addStage}
              className="flex w-full items-center justify-center gap-1.5 rounded-[14px] border border-dashed border-[#d8ccb8] bg-panel py-3 text-[13px] font-semibold text-amber-ink shadow-[0_1px_2px_rgba(74,50,34,.04)] hover:border-amber hover:bg-[#faf5ec] transition-colors focus:outline-none"
            >
              + Add stage
            </button>
          </div>
        </>
      )}

      <RecipeForm open={editOpen} onClose={() => setEditOpen(false)} materials={materials} mode="edit" recipe={recipe} />
    </div>
  );
}
