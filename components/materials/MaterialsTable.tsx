"use client";
import { useState, useTransition, useMemo, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import type { MaterialVM } from "@/lib/domain/types";
import { toggleActive } from "@/app/materials/actions";
import { Table, Th, Td } from "@/components/ui/Table";
import { Pill, TypeTag } from "@/components/ui/Pill";
import { Button } from "@/components/ui/Button";
import { PageIntro } from "@/components/ui/PageIntro";
import { SyncButton } from "./SyncButton";
import { MaterialForm } from "./MaterialForm";
import { EditMaterialDrawer } from "./EditMaterialDrawer";
import { toast } from "@/components/ui/Toast";

type TypeFilter = "ALL" | "PRODUCT" | "INTERMEDIATE" | "RAW";
type StatusFilter = "ALL" | "ACTIVE" | "INACTIVE";

const TYPE_OPTIONS: { key: TypeFilter; label: string }[] = [
  { key: "ALL", label: "All type" },
  { key: "PRODUCT", label: "Product" },
  { key: "INTERMEDIATE", label: "Intermediate" },
  { key: "RAW", label: "Raw" },
];

const STATUS_OPTIONS: { key: StatusFilter; label: string; dotColor: string }[] = [
  { key: "ALL", label: "All status", dotColor: "#93856f" },
  { key: "ACTIVE", label: "Active", dotColor: "#556b2c" },
  { key: "INACTIVE", label: "Inactive", dotColor: "#93856f" },
];

export function MaterialsTable({
  materials,
  lastSync,
}: {
  materials: MaterialVM[];
  lastSync?: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [editingMaterial, setEditingMaterial] = useState<MaterialVM | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();

  // Filters state
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedType, setSelectedType] = useState<TypeFilter>("ALL");
  const [selectedStatus, setSelectedStatus] = useState<StatusFilter>("ALL");
  const [statusOpen, setStatusOpen] = useState(false);
  const statusRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (statusRef.current && !statusRef.current.contains(e.target as Node)) {
        setStatusOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const onToggle = (materialId: string) =>
    start(async () => {
      const res = await toggleActive(materialId);
      toast(res);
      router.refresh();
    });

  const filteredMaterials = useMemo(() => {
    return materials.filter((m) => {
      // 1. Search filter (ID or name)
      const term = searchQuery.trim().toLowerCase();
      if (term) {
        const matchId = m.materialId.toLowerCase().includes(term);
        const matchName = m.name.toLowerCase().includes(term);
        if (!matchId && !matchName) return false;
      }

      // 2. Type filter
      if (selectedType !== "ALL" && m.type !== selectedType) {
        return false;
      }

      // 3. Status filter
      if (selectedStatus === "ACTIVE" && !m.active) return false;
      if (selectedStatus === "INACTIVE" && m.active) return false;

      return true;
    });
  }, [materials, searchQuery, selectedType, selectedStatus]);

  const isFiltered = searchQuery.trim() !== "" || selectedType !== "ALL" || selectedStatus !== "ALL";
  const currentStatus = STATUS_OPTIONS.find((s) => s.key === selectedStatus) ?? STATUS_OPTIONS[0];

  return (
    <>
      <PageIntro action={<SyncButton initialLastSync={lastSync} />}>
        <div>
          Item master. Each material syncs to Batchline via{" "}
          <code className="font-mono text-[12px] text-amber-ink">/api/v1/material/create</code> for every create
          and status change is synced and logged as an outbound message.
          <div className="mt-1 text-[12px] text-muted">
            {isFiltered ? (
              <span>
                Showing <strong className="font-mono text-espresso">{filteredMaterials.length}</strong> of{" "}
                <strong className="font-mono text-espresso">{materials.length}</strong> materials found
              </span>
            ) : (
              <span>
                Total <strong className="font-mono text-espresso">{materials.length}</strong> materials
              </span>
            )}
          </div>
        </div>
      </PageIntro>

      <div className="mb-3.5 flex flex-wrap items-center justify-between gap-3">
        {/* Left: Search input & Type segmented tabs */}
        <div className="flex flex-wrap items-center gap-3">
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
              placeholder="Search ID or name — Enter"
              className="w-[230px] rounded-lg border border-[#d8ccb8] bg-panel pl-8 pr-3 py-2 text-[12.5px] text-ink placeholder:text-faint focus:border-amber focus:outline-none"
            />
          </div>

          <div className="inline-flex items-center rounded-xl border border-[#e2d6c3] bg-[#f0e7d8] p-1">
            {TYPE_OPTIONS.map((opt) => {
              const active = selectedType === opt.key;
              return (
                <button
                  key={opt.key}
                  type="button"
                  onClick={() => setSelectedType(opt.key)}
                  className={`rounded-[8px] px-3 py-1 text-[12px] transition-all ${active
                    ? "bg-espresso font-semibold text-white shadow-sm"
                    : "font-medium text-[#7c6d58] hover:text-espresso"
                    }`}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Right: Status dropdown filter & New material button */}
        <div className="flex items-center gap-2.5">
          <div className="relative" ref={statusRef}>
            <button
              type="button"
              onClick={() => setStatusOpen((prev) => !prev)}
              className="inline-flex items-center gap-2 rounded-[9px] border border-[#d8ccb8] bg-panel px-3.5 py-2 text-[12.5px] font-semibold text-espresso hover:bg-panel-2 focus:outline-none"
            >
              <span className="h-2 w-2 rounded-full flex-none" style={{ background: currentStatus.dotColor }} />
              <span>{currentStatus.label}</span>
              <svg
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2.4}
                strokeLinecap="round"
                strokeLinejoin="round"
                className={`transition-transform duration-150 ${statusOpen ? "rotate-180" : ""}`}
              >
                <path d="M6 9l6 6 6-6" />
              </svg>
            </button>

            {statusOpen && (
              <div className="absolute right-0 top-full mt-1.5 min-w-[140px] rounded-[10px] border border-[#d8ccb8] bg-panel p-1 shadow-[0_12px_30px_rgba(46,32,22,.18)] z-30">
                {STATUS_OPTIONS.map((opt) => (
                  <button
                    key={opt.key}
                    type="button"
                    onClick={() => {
                      setSelectedStatus(opt.key);
                      setStatusOpen(false);
                    }}
                    className={`flex w-full items-center gap-2.5 rounded-[7px] px-3 py-2 text-left text-[12.5px] transition-colors ${selectedStatus === opt.key
                      ? "bg-[#ede4d4] font-semibold text-espresso"
                      : "font-medium text-ink hover:bg-panel-2"
                      }`}
                  >
                    <span className="h-2 w-2 rounded-full flex-none" style={{ background: opt.dotColor }} />
                    <span>{opt.label}</span>
                    {selectedStatus === opt.key && (
                      <svg className="ml-auto" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                        <path d="M20 6L9 17l-5-5" />
                      </svg>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>

          <Button onClick={() => setOpen(true)}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
            New material
          </Button>
        </div>
      </div>

      <Table className="table-fixed" containerClassName="max-h-[calc(100vh-245px)] overflow-y-auto">
        <colgroup>
          <col className="w-[16%]" />
          <col className="w-[28%]" />
          <col className="w-[14%]" />
          <col className="w-[9%]" />
          <col className="w-[12%]" />
          <col className="w-[10%]" />
          <col className="w-[11%]" />
        </colgroup>
        <thead>
          <tr>
            <Th className="w-[16%]">Material ID</Th>
            <Th className="w-[28%]">Name</Th>
            <Th className="w-[14%]">Type</Th>
            <Th className="w-[9%]">UOM</Th>
            <Th className="w-[12%]">Shelf life</Th>
            <Th className="w-[10%]">Status</Th>
            <Th className="w-[11%]" right />
          </tr>
        </thead>
        <tbody>
          {filteredMaterials.map((m) => (
            <tr key={m.id} style={{ background: m.active ? undefined : "#faf6ee" }}>
              <Td mono className="font-semibold text-espresso">{m.materialId}</Td>
              <Td className="text-ink">{m.name}</Td>
              <Td><TypeTag type={m.type} /></Td>
              <Td mono className="text-muted">{m.uom}</Td>
              <Td className="text-muted">{m.shelfLifeLabel}</Td>
              <Td><Pill status={m.active ? "ACTIVE" : "INACTIVE"} /></Td>
              <Td right>
                <button
                  onClick={() => setEditingMaterial(m)}
                  className="inline-flex items-center gap-1.5 rounded-md border border-[#e0d3bf] px-3 py-1.5 text-[12px] font-semibold text-amber-ink hover:bg-panel-2"
                >
                  <svg
                    width="12.5"
                    height="12.5"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={2.2}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="opacity-75"
                  >
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                  </svg>
                  <span>Edit</span>
                </button>
              </Td>
            </tr>
          ))}
          {filteredMaterials.length === 0 && (
            <tr>
              <td colSpan={7} className="border-t border-line px-9 py-9 text-center text-[13px] text-faint">
                No materials match this filter.
              </td>
            </tr>
          )}
        </tbody>
      </Table>

      <MaterialForm open={open} onClose={() => setOpen(false)} />
      <EditMaterialDrawer material={editingMaterial} onClose={() => setEditingMaterial(null)} />
    </>
  );
}
