"use client";
import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { RecipeVM } from "@/lib/data/recipes";
import type { MaterialVM } from "@/lib/domain/types";
import { Table, Th, Td } from "@/components/ui/Table";
import { Button } from "@/components/ui/Button";
import { RecipeForm } from "./RecipeForm";

type SortKey = "recipeId" | "product" | "productId";

export function RecipesTable({ recipes, materials }: { recipes: RecipeVM[]; materials: MaterialVM[] }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [applied, setApplied] = useState("");
  const [sort, setSort] = useState<{ key: SortKey | null; dir: "asc" | "desc" }>({ key: null, dir: "asc" });
  const router = useRouter();

  const rows = useMemo(() => {
    let list = recipes;
    const s = applied.trim().toLowerCase();
    if (s) list = list.filter((r) => r.recipeId.toLowerCase().includes(s) || r.product.toLowerCase().includes(s) || r.productId.toLowerCase().includes(s));
    if (sort.key) {
      const dir = sort.dir === "asc" ? 1 : -1;
      list = [...list].sort((a, b) => {
        const av = (a[sort.key!] as string).toLowerCase();
        const bv = (b[sort.key!] as string).toLowerCase();
        return av < bv ? -dir : av > bv ? dir : 0;
      });
    }
    return list;
  }, [recipes, applied, sort]);

  const toggleSort = (key: SortKey) =>
    setSort((s) => (s.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: "asc" }));
  const arrow = (k: SortKey) => (sort.key === k ? (sort.dir === "asc" ? "▲" : "▼") : "↕");

  return (
    <>
      <div className="mb-3.5 flex items-center gap-3">
        <input
          value={q}
          onChange={(e) => { setQ(e.target.value); if (!e.target.value) setApplied(""); }}
          onKeyDown={(e) => e.key === "Enter" && setApplied(q)}
          placeholder="Search recipe ID, product or product ID — Enter"
          className="w-[300px] rounded-lg border border-[#d8ccb8] bg-panel px-3 py-2 text-[12.5px] focus:border-amber focus:outline-none"
        />
        <Button className="ml-auto" onClick={() => setOpen(true)}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
          New recipe
        </Button>
      </div>

      <Table>
        <thead>
          <tr>
            <th onClick={() => toggleSort("recipeId")} className="cursor-pointer select-none bg-panel-2 px-[18px] py-3 text-left text-[10.5px] font-semibold uppercase tracking-[.8px] text-[#93856f]">Recipe ID <span className="text-[9px] text-amber-ink">{arrow("recipeId")}</span></th>
            <th onClick={() => toggleSort("product")} className="cursor-pointer select-none bg-panel-2 px-[18px] py-3 text-left text-[10.5px] font-semibold uppercase tracking-[.8px] text-[#93856f]">Product <span className="text-[9px] text-amber-ink">{arrow("product")}</span></th>
            <th onClick={() => toggleSort("productId")} className="cursor-pointer select-none bg-panel-2 px-[18px] py-3 text-left text-[10.5px] font-semibold uppercase tracking-[.8px] text-[#93856f]">Product ID <span className="text-[9px] text-amber-ink">{arrow("productId")}</span></th>
            <Th right>Stages</Th><Th right>BOM lines</Th><Th right>Yield</Th><Th right />
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="cursor-pointer hover:bg-[#faf5ec]" onClick={() => router.push(`/recipes/${r.recipeId}`)}>
              <Td mono className="font-semibold text-espresso">{r.recipeId}</Td>
              <Td className="text-ink">{r.product}</Td>
              <Td mono className="text-[12px] text-amber-ink">{r.productId}</Td>
              <Td mono right className="text-ink">{r.stageCount}</Td>
              <Td mono right className="text-ink">{r.bomCount}</Td>
              <Td mono right className="text-muted">{r.yieldPct ?? "—"}%</Td>
              <Td right><span className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-amber-ink">Open<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round"><path d="M9 18l6-6-6-6" /></svg></span></Td>
            </tr>
          ))}
          {rows.length === 0 && (
            <tr><td colSpan={7} className="border-t border-line px-9 py-9 text-center text-[13px] text-faint">No recipes match this search.</td></tr>
          )}
        </tbody>
      </Table>

      <RecipeForm open={open} onClose={() => setOpen(false)} materials={materials} mode="create" />
    </>
  );
}
