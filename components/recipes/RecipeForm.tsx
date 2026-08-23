"use client";
import { useState, useTransition, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import type { MaterialVM } from "@/lib/domain/types";
import type { RecipeVM } from "@/lib/data/recipes";
import { createRecipe, updateRecipeHeader } from "@/app/recipes/actions";
import { Modal, ModalHeader } from "@/components/ui/Modal";
import { Field, TextInput, Select } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { toast } from "@/components/ui/Toast";

export function RecipeForm({
  open,
  onClose,
  materials,
  mode,
  recipe,
}: {
  open: boolean;
  onClose: () => void;
  materials: MaterialVM[];
  mode: "create" | "edit";
  recipe?: RecipeVM;
}) {
  const [pending, start] = useTransition();
  const router = useRouter();
  const products = useMemo(
    () => materials.filter((m) => m.type === "PRODUCT" || m.type === "INTERMEDIATE"),
    [materials]
  );

  const [f, setF] = useState({
    recipeId: recipe?.recipeId ?? "",
    productId: recipe?.productId ?? products[0]?.materialId ?? "",
    baseSize: recipe?.baseSize ?? "",
    yieldPct: recipe?.yieldPct ?? "",
    note: recipe?.note ?? "",
  });

  // Re-sync form state when modal opens
  useEffect(() => {
    if (open) {
      setF({
        recipeId: recipe?.recipeId ?? "",
        productId: recipe?.productId ?? (products[0]?.materialId ?? ""),
        baseSize: recipe?.baseSize ?? "",
        yieldPct: recipe?.yieldPct ?? "",
        note: recipe?.note ?? "",
      });
    }
  }, [open, recipe]);

  const selectedProduct = products.find((p) => p.materialId === f.productId) || products[0];
  const uom = selectedProduct?.uom ?? "kg";

  const handleProductChange = (productId: string) => {
    setF((prev) => ({
      ...prev,
      productId,
    }));
  };

  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setF((s) => ({ ...s, [k]: e.target.value }));

  const submit = () => {
    if (!f.recipeId.trim()) {
      toast({ ok: false, message: "Recipe ID is required", system: "pathline" });
      return;
    }
    const baseSizeNum = Number(f.baseSize);
    if (!baseSizeNum || baseSizeNum <= 0) {
      toast({ ok: false, message: "Base size must be greater than 0", system: "pathline" });
      return;
    }
    const yieldNum = Number(f.yieldPct);
    if (yieldNum < 0 || yieldNum > 100) {
      toast({ ok: false, message: "Expected yield must be between 0% and 100%", system: "pathline" });
      return;
    }

    start(async () => {
      const input = {
        recipeId: f.recipeId.trim(),
        productMaterialId: f.productId,
        baseSize: baseSizeNum,
        yieldPct: yieldNum,
        note: f.note.trim(),
      };
      const res = mode === "create" ? await createRecipe(input) : await updateRecipeHeader(input);
      toast(res);
      if (!res.ok) return;
      onClose();
      if (mode === "create" && "recipeId" in res && res.recipeId) {
        router.push(`/recipes/${res.recipeId}`);
      } else {
        router.refresh();
      }
    });
  };

  return (
    <Modal open={open} onClose={onClose} width={580}>
      <ModalHeader title={mode === "create" ? "Create Master Recipe" : `Edit Details · ${f.recipeId}`} onClose={onClose} />
      <div className="flex flex-col gap-4 px-6 py-[22px]">
        <Field label="Recipe ID" hint={mode === "create" ? "Unique business identifier for this recipe" : "Recipe ID cannot be changed"}>
          <TextInput
            mono
            value={f.recipeId}
            onChange={set("recipeId")}
            disabled={mode === "edit"}
            placeholder="e.g. RCP-IBU-01"
          />
        </Field>

        <Field label="Target Output Product / Intermediate">
          <Select value={f.productId} onChange={(e) => handleProductChange(e.target.value)}>
            {products.map((p) => (
              <option key={p.id} value={p.materialId}>
                {p.name} · {p.materialId} ({p.type.toLowerCase()})
              </option>
            ))}
          </Select>
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Standard Base Size" hint={`Unit is inherited: ${uom}`}>
            <div className="flex gap-1.5">
              <TextInput mono value={f.baseSize} onChange={set("baseSize")} placeholder="300" />
              <span className="flex items-center rounded-lg border border-border bg-panel-2 px-3 font-mono text-[12px] font-semibold text-espresso">
                {uom}
              </span>
            </div>
          </Field>

          <Field label="Expected Yield %" hint="Nominal expected output">
            <div className="flex gap-1.5">
              <TextInput mono value={f.yieldPct} onChange={set("yieldPct")} placeholder="98.5" />
              <span className="flex items-center rounded-lg border border-border bg-panel-2 px-3 font-mono text-[12px] font-semibold text-espresso">
                %
              </span>
            </div>
          </Field>
        </div>

        <Field label="Description / Route Note">
          <TextInput value={f.note} onChange={set("note")} placeholder="e.g. Standard wet granulation and compression route" />
        </Field>
      </div>

      <div className="flex justify-end gap-2.5 border-t border-line px-6 pb-5 pt-3.5">
        <Button variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button disabled={pending} onClick={submit}>
          {pending ? "Saving…" : mode === "create" ? "Create Recipe" : "Save Changes"}
        </Button>
      </div>
    </Modal>
  );
}
