"use client";
import { usePathname } from "next/navigation";

function meta(pathname: string): { crumb: string; title: string } {
  if (pathname.startsWith("/materials")) return { crumb: "Pathline ERP", title: "Materials" };
  if (pathname.startsWith("/inventory")) return { crumb: "Pathline ERP", title: "Inventory & lots" };
  if (/^\/recipes\/[^/]+/.test(pathname)) {
    const id = decodeURIComponent(pathname.split("/")[2] ?? "");
    return { crumb: "Pathline ERP / Recipes", title: `Recipe ${id}` };
  }
  if (pathname.startsWith("/recipes")) return { crumb: "Pathline ERP", title: "Recipes" };
  if (pathname.startsWith("/lims")) return { crumb: "Assayline LIMS / Quality control", title: "In-Process Control — Hold Points" };
  if (/^\/orders\/[^/]+/.test(pathname)) {
    const no = decodeURIComponent(pathname.split("/")[2] ?? "");
    return { crumb: "Pathline ERP / Orders", title: `Order ${no}` };
  }
  return { crumb: "Pathline ERP", title: "Process orders" };
}

export function Topbar() {
  const { crumb, title } = meta(usePathname());
  return (
    <header className="relative z-[2] flex h-[62px] flex-none items-center gap-[18px] border-b border-border bg-panel px-[26px]">
      <div className="min-w-0 flex-1">
        <div className="font-mono text-[11px] text-faint">{crumb}</div>
        <div className="mt-px text-[17px] font-semibold leading-tight text-ink">{title}</div>
      </div>
      <div className="flex items-center gap-[18px]">
        <div className="flex items-center gap-3.5 rounded-full border border-border bg-panel-2 px-3.5 py-[7px]">
          <span className="flex items-center gap-[7px]">
            <span className="h-2.5 w-2.5 flex-none rounded-[3px] bg-espresso" />
            <span className="text-[11.5px] font-semibold text-espresso">Pathline</span>
            <span className="text-[10.5px] text-faint">ERP</span>
          </span>
          <span className="h-4 w-px bg-[#e0d3bf]" />
          <span className="flex items-center gap-[7px]">
            <span className="h-2.5 w-2.5 flex-none rounded-[3px] bg-amber" />
            <span className="text-[11.5px] font-semibold text-amber-deep">Batchline</span>
            <span className="text-[10.5px] text-faint">Plant</span>
          </span>
        </div>
        <div className="flex h-[34px] w-[34px] items-center justify-center rounded-full border border-[#e0d3bf] bg-[#efe4d3] text-[12px] font-semibold text-espresso-ink">
          PL
        </div>
      </div>
    </header>
  );
}
