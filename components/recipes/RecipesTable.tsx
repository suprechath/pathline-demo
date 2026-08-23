"use client";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { RecipeVM } from "@/lib/data/recipes";
import type { MaterialVM } from "@/lib/domain/types";
import { Table, Th, Td } from "@/components/ui/Table";
import { Button } from "@/components/ui/Button";
import { PageIntro } from "@/components/ui/PageIntro";
import { RecipeForm } from "./RecipeForm";

type SortKey = "recipeId" | "product" | "productId" | "stageCount" | "bomCount" | "yieldPct";

export function RecipesTable({ recipes, materials }: { recipes: RecipeVM[]; materials: MaterialVM[] }) {
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [sort, setSort] = useState<{ key: SortKey | null; dir: "asc" | "desc" }>({ key: null, dir: "asc" });
  const router = useRouter();

  const rows = useMemo(() => {
    let list = recipes;
    const s = searchQuery.trim().toLowerCase();
    if (s) {
      list = list.filter(
        (r) =>
          r.recipeId.toLowerCase().includes(s) ||
          r.product.toLowerCase().includes(s) ||
          r.productId.toLowerCase().includes(s)
      );
    }
    if (sort.key) {
      const dir = sort.dir === "asc" ? 1 : -1;
      list = [...list].sort((a, b) => {
        const ak = sort.key!;
        if (ak === "stageCount" || ak === "bomCount") {
          return (a[ak] - b[ak]) * dir;
        }
        if (ak === "yieldPct") {
          const ay = Number(a.yieldPct) || 0;
          const by = Number(b.yieldPct) || 0;
          return (ay - by) * dir;
        }
        const av = (a[ak] as string || "").toLowerCase();
        const bv = (b[ak] as string || "").toLowerCase();
        return av < bv ? -dir : av > bv ? dir : 0;
      });
    }
    return list;
  }, [recipes, searchQuery, sort]);

  const isFiltered = searchQuery.trim() !== "";

  const toggleSort = (key: SortKey) =>
    setSort((s) => (s.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: "asc" }));

  const arrow = (k: SortKey) => (sort.key === k ? (sort.dir === "asc" ? "▲" : "▼") : "↕");

  return (
    <>
      <PageIntro className="max-w-[760px]">
        <div>
          <div>Master recipes. A recipe defines the stage → output → BOM mapping for a product.</div>
          <div>Orders instantiate an approved recipe rather than defining stages by hand, so planners cannot mis-map a stage.</div>
          <div className="mt-1 text-[12px] text-muted">
            {isFiltered ? (
              <span>
                Showing <strong className="font-mono text-espresso">{rows.length}</strong> of{" "}
                <strong className="font-mono text-espresso">{recipes.length}</strong> recipes found
              </span>
            ) : (
              <span>
                Total <strong className="font-mono text-espresso">{recipes.length}</strong> recipes
              </span>
            )}
          </div>
        </div>
      </PageIntro>

      <div className="mb-3.5 flex items-center justify-between gap-3">
        <div className="relative flex items-center">
          <svg
            className="pointer-events-none absolute left-3 text-faint"
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2.4}
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.3-4.3" />
          </svg>
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search recipe ID, product or product ID — Enter"
            className="w-[340px] rounded-lg border border-[#d8ccb8] bg-panel pl-8 pr-8 py-2 text-[12.5px] text-ink placeholder:text-faint focus:border-amber focus:outline-none"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              className="absolute right-2.5 text-faint hover:text-ink focus:outline-none"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
        <Button onClick={() => setOpen(true)}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
          New recipe
        </Button>
      </div>

      <Table containerClassName="max-h-[calc(100vh-245px)] overflow-y-auto">
        <thead>
          <tr>
            <Th onClick={() => toggleSort("recipeId")} className="cursor-pointer select-none">
              Recipe ID <span className="text-[9px] text-amber-ink">{arrow("recipeId")}</span>
            </Th>
            <Th onClick={() => toggleSort("product")} className="cursor-pointer select-none">
              Product <span className="text-[9px] text-amber-ink">{arrow("product")}</span>
            </Th>
            <Th onClick={() => toggleSort("productId")} className="cursor-pointer select-none">
              Product ID <span className="text-[9px] text-amber-ink">{arrow("productId")}</span>
            </Th>
            <Th right onClick={() => toggleSort("stageCount")} className="cursor-pointer select-none">
              Stages <span className="text-[9px] text-amber-ink">{arrow("stageCount")}</span>
            </Th>
            <Th right onClick={() => toggleSort("bomCount")} className="cursor-pointer select-none">
              BOM lines <span className="text-[9px] text-amber-ink">{arrow("bomCount")}</span>
            </Th>
            <Th right onClick={() => toggleSort("yieldPct")} className="cursor-pointer select-none">
              Yield <span className="text-[9px] text-amber-ink">{arrow("yieldPct")}</span>
            </Th>
            <Th right />
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="cursor-pointer hover:bg-[#faf5ec] transition-colors" onClick={() => router.push(`/recipes/${r.recipeId}`)}>
              <Td mono className="font-semibold text-espresso">{r.recipeId}</Td>
              <Td className="text-ink font-medium">{r.product}</Td>
              <Td mono className="text-[12px] text-amber-ink">{r.productId}</Td>
              <Td mono right className="text-ink">{r.stageCount}</Td>
              <Td mono right className="text-ink">{r.bomCount}</Td>
              <Td mono right className="text-muted">{r.yieldPct ?? "—"}%</Td>
              <Td right>
                <span className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-amber-ink">
                  Open
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round">
                    <path d="M9 18l6-6-6-6" />
                  </svg>
                </span>
              </Td>
            </tr>
          ))}
          {rows.length === 0 && (
            <tr>
              <td colSpan={7} className="border-t border-line px-9 py-9 text-center text-[13px] text-faint">
                No recipes match this search.
              </td>
            </tr>
          )}
        </tbody>
      </Table>

      <RecipeForm open={open} onClose={() => setOpen(false)} materials={materials} mode="create" />
    </>
  );
}
