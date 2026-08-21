"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV = [
  { href: "/materials", label: "Materials", icon: "M4 7l8-4 8 4v10l-8 4-8-4z|M4 7l8 4 8-4|M12 11v10" },
  { href: "/inventory", label: "Inventory", icon: "rect:3,8,18,12|M3 8l2.5-4h13L21 8|M12 4v4M8 12h8" },
  { href: "/recipes", label: "Recipes", icon: "M4 4h11l5 5v11a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1z|M14 4v5h5|M8 13h6M8 16.5h4" },
  { href: "/orders", label: "Orders", icon: "rect:5,3,14,18|M9 8h6M9 12h6M9 16h4" },
  { href: "/lims", label: "Quality (LIMS)", icon: "M9 3h6|M10 3v5.5L5.2 18a2 2 0 0 0 1.8 3h10a2 2 0 0 0 1.8-3L14 8.5V3|M7.5 14h9", accent: true },
];

function Icon({ spec }: { spec: string }) {
  const parts = spec.split("|");
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      {parts.map((p, i) => {
        if (p.startsWith("rect:")) {
          const [x, y, w, h] = p.slice(5).split(",").map(Number);
          return <rect key={i} x={x} y={y} width={w} height={h} rx={1.8} />;
        }
        return <path key={i} d={p} />;
      })}
    </svg>
  );
}

export function Sidebar() {
  const pathname = usePathname();
  return (
    <aside className="flex w-[236px] flex-none flex-col bg-gradient-to-b from-espresso-deep to-espresso py-6 text-[#efe4d3]">
      <div className="flex items-center gap-3 px-6 pb-6">
        <div className="flex h-[34px] w-[34px] flex-none items-center justify-center rounded-[9px] bg-[#efe4d3]">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#4a3222" strokeWidth={2.1} strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 7l8-4 8 4v10l-8 4-8-4z" /><path d="M4 7l8 4 8-4" /><path d="M12 11v10" />
          </svg>
        </div>
        <div>
          <div className="text-[15px] font-bold leading-none tracking-[.2px]">Pathline</div>
          <div className="mt-[3px] text-[10.5px] uppercase tracking-[2.4px] text-[#c3ad8f]">ERP</div>
        </div>
      </div>

      <nav className="flex flex-1 flex-col gap-[2px] px-3 py-1.5">
        {NAV.map((n) => {
          const active = pathname.startsWith(n.href);
          // Quality (LIMS) is a distinct system (violet Assayline) — flag it.
          const accentActive = active && n.accent;
          return (
            <Link
              key={n.href}
              href={n.href}
              style={accentActive ? { background: "rgba(124,77,255,.24)" } : undefined}
              className={`flex items-center gap-3 rounded-[9px] px-[13px] py-[10px] text-[13.5px] font-medium ${
                active ? "text-white" : "text-[#d9c8ae] hover:bg-amber/10"
              } ${active && !n.accent ? "bg-amber/20" : ""}`}
            >
              <span className="flex h-[18px] w-[18px] flex-none" style={n.accent ? { color: active ? "#c9b6ff" : "#b39ff0" } : undefined}><Icon spec={n.icon} /></span>
              {n.label}
            </Link>
          );
        })}
      </nav>

      <div className="mx-3 border-t border-[#efe4d3]/[.13] px-5 pt-3.5">
        <div className="mb-2 text-[10px] uppercase tracking-[1.6px] text-[#a68f70]">Environment</div>
        <div className="flex items-center gap-2 text-[12px] text-[#d9c8ae]">
          <span className="h-2 w-2 flex-none rounded-full bg-[#8fae5b]" />
          <span className="font-mono">localhost:5432</span>
        </div>
        <div className="mt-[5px] pl-4 text-[11px] text-[#a68f70]">Postgres 16 · Docker</div>
      </div>
    </aside>
  );
}
