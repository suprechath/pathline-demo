"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { MaterialVM } from "@/lib/domain/types";
import type { RecipeVM } from "@/lib/data/recipes";
import { createRecipe, updateRecipeHeader } from "@/app/recipes/actions";
import { Modal, ModalHeader } from "@/components/ui/Modal";
import { Field, TextInput, Select } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { toast } from "@/components/ui/Toast";

export function RecipeForm({
  open, onClose, materials, mode, recipe,
}: {
  open: boolean; onClose: () => void; materials: MaterialVM[]; mode: "create" | "edit"; recipe?: RecipeVM;
}) {
  const [pending, start] = useTransition();
  const router = useRouter();
  const products = materials.filter((m) => m.type === "PRODUCT" || m.type === "INTERMEDIATE");
  const [f, setF] = useState({
    recipeId: recipe?.recipeId ?? "",
    productId: recipe?.productId ?? products[0]?.materialId ?? "",
    baseSize: recipe?.baseSize ?? "300",
    yieldPct: recipe?.yieldPct ?? "99",
    note: recipe?.note ?? "",
  });
  const uom = products.find((p) => p.materialId === f.productId)?.uom ?? "kg";
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF((s) => ({ ...s, [k]: e.target.value }));

  const submit = () =>
    start(async () => {
      const input = { recipeId: f.recipeId, productMaterialId: f.productId, baseSize: Number(f.baseSize), yieldPct: Number(f.yieldPct), note: f.note };
      const res = mode === "create" ? await createRecipe(input) : await updateRecipeHeader(input);
      toast(res);
      if (!res.ok) return;
      onClose();
      if (mode === "create" && "recipeId" in res && res.recipeId) router.push(`/recipes/${res.recipeId}`);
      else router.refresh();
    });

  return (
    <Modal open={open} onClose={onClose}>
      <ModalHeader title={mode === "create" ? "Create recipe" : `Edit ${f.recipeId}`} onClose={onClose} />
      <div className="flex flex-col gap-4 px-6 py-[22px]">
        <Field label="Recipe ID"><TextInput mono value={f.recipeId} onChange={set("recipeId")} disabled={mode === "edit"} placeholder="RCP-BLEND-03" /></Field>
        <Field label="Product (Product / Intermediate)">
          <Select value={f.productId} onChange={set("productId")}>
            {products.map((p) => <option key={p.id} value={p.materialId}>{p.name} · {p.materialId}</option>)}
          </Select>
        </Field>
        <Field label="Base size" hint="Unit is inherited from the selected product.">
          <div className="flex gap-1.5">
            <TextInput mono value={f.baseSize} onChange={set("baseSize")} />
            <span className="flex items-center rounded-lg border border-border bg-panel-2 px-3 font-mono text-[12px] text-muted">{uom}</span>
          </div>
        </Field>
        <Field label="Expected yield %"><TextInput mono value={f.yieldPct} onChange={set("yieldPct")} /></Field>
        <Field label="Note"><TextInput value={f.note} onChange={set("note")} placeholder="Short description of the route" /></Field>
      </div>
      <div className="flex justify-end gap-2.5 border-t border-line px-6 pb-5 pt-3.5">
        <Button variant="outline" onClick={onClose}>Cancel</Button>
        <Button disabled={pending} onClick={submit}>{pending ? "Saving…" : mode === "create" ? "Create recipe" : "Save changes"}</Button>
      </div>
    </Modal>
  );
}
