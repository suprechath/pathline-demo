"use server";
import { revalidatePath } from "next/cache";
import { MaterialType, ShelfLifeUom } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { materialSchema } from "@/lib/domain/validation";

import { formatBatchlineErrorDetail } from "@/lib/batchline/errors";

const BATCHLINE_API_KEY = process.env.BATCHLINE_API_KEY ?? "";
const BATCHLINE_MATERIAL_API_URL =
  process.env.BATCHLINE_MATERIAL_API_URL ??
  "https://material-demo.bl-client.com/api/v1/material/get";
const BATCHLINE_MATERIAL_CREATE_API_URL =
  process.env.BATCHLINE_MATERIAL_CREATE_API_URL ??
  "https://material-demo.bl-client.com/api/v1/material/create";
const BATCHLINE_MATERIAL_UPDATE_API_URL =
  process.env.BATCHLINE_MATERIAL_UPDATE_API_URL ??
  "https://material-demo.bl-client.com/api/v1/material/update";

function formatMaterialTypeForBatchline(type: MaterialType): string {
  if (type === "INTERMEDIATE") return "Intermediate";
  if (type === "PRODUCT") return "Product";
  return "Raw";
}

function formatShelfLifeUomForBatchline(uom: ShelfLifeUom): string {
  switch (uom) {
    case "YEARS":
      return "Years";
    case "MONTHS":
      return "Months";
    case "DAYS":
      return "Days";
    case "HOURS":
      return "Hours";
    case "MINUTES":
      return "Minutes";
    default:
      return "Years";
  }
}

export interface ActionResult {
  ok: boolean;
  message: string;
  system?: "pathline" | "batchline";
}

export async function createMaterial(form: FormData): Promise<ActionResult> {
  const rawId = (form.get("materialId") as string | null)?.trim() ?? "";
  const rawName = (form.get("name") as string | null)?.trim() ?? "";
  const rawType = ((form.get("type") as string | null)?.trim().toUpperCase() || "RAW") as string;
  const rawUom = (form.get("uom") as string | null)?.trim() || "kg";
  const rawShelfLife = form.get("shelfLife");
  const rawShelfLifeUom = ((form.get("shelfLifeUom") as string | null)?.trim().toUpperCase() || "YEARS") as string;

  const parsed = materialSchema.safeParse({
    materialId: rawId,
    name: rawName,
    type: rawType,
    uom: rawUom,
    shelfLife: rawType === "RAW" ? 0 : rawShelfLife ?? 0,
    shelfLifeUom: rawShelfLifeUom,
  });

  if (!parsed.success) {
    const errorMsg = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join(", ");
    return { ok: false, message: errorMsg, system: "pathline" };
  }
  const data = parsed.data;

  // 1. Record in prisma.material
  let created;
  try {
    created = await prisma.material.create({
      data: {
        ...data,
        active: true,
        reason: (form.get("reason") as string) || "ERP Interface",
      },
    });
  } catch (e) {
    const dup = e instanceof Error && e.message.includes("Unique");
    return { ok: false, message: dup ? "Material ID already exists" : "Failed to create material in database", system: "pathline" };
  }

  // 2. Call Batchline API
  const batchlinePayload = {
    materials: [
      {
        material_id: created.materialId,
        material_name: created.name,
        material_type: formatMaterialTypeForBatchline(created.type),
        material_uom: created.uom,
        shelf_life: created.shelfLife,
        shelf_life_uom: formatShelfLifeUomForBatchline(created.shelfLifeUom),
        comment: (form.get("comment") as string) || "This is an example of material open API.",
        active: created.active,
        reason: "ERP Interface",
      },
    ],
  };

  let responseData: any = null;
  let responseStatus = 200;
  let isSuccess = false;

  try {
    const res = await fetch(BATCHLINE_MATERIAL_CREATE_API_URL, {
      method: "POST",
      headers: {
        "x-api-key": BATCHLINE_API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(batchlinePayload),
      cache: "no-store",
    });

    responseStatus = res.status;
    try {
      responseData = await res.json();
    } catch {
      responseData = { status: res.statusText };
    }

    isSuccess = res.ok;
  } catch (apiErr) {
    console.error("Batchline /material/create API error:", apiErr);
    responseStatus = 502;
    responseData = { error: apiErr instanceof Error ? apiErr.message : "Network error" };
    isSuccess = false;
  }

  // Log outbound Integration Message
  await prisma.integrationMessage.create({
    data: {
      direction: "OUTBOUND",
      endpoint: "/api/v1/material/create",
      method: "POST",
      entityType: "material",
      entityRef: created.materialId,
      status: isSuccess ? "DELIVERED" : "FAILED",
      httpStatus: responseStatus,
      payload: batchlinePayload as any,
      response: responseData as any,
    },
  });

  // 3. Rollback prisma.material if API call failed
  if (!isSuccess) {
    await prisma.material.delete({ where: { id: created.id } });
    const errorDetail = formatBatchlineErrorDetail(responseData, responseStatus);
    return {
      ok: false,
      message: `Batchline creation failed (${errorDetail}). Database record rolled back.`,
      system: "batchline",
    };
  }

  revalidatePath("/materials");
  return { ok: true, message: `Synced ${created.materialId} → Batchline /material/create`, system: "batchline" };
}

export async function updateMaterial(form: FormData): Promise<ActionResult> {
  const rawId = (form.get("materialId") as string | null)?.trim() ?? "";
  if (!rawId) return { ok: false, message: "Material ID is required", system: "pathline" };

  const rawName = (form.get("name") as string | null)?.trim() ?? "";
  const rawType = ((form.get("type") as string | null)?.trim().toUpperCase() || "RAW") as string;
  const rawUom = (form.get("uom") as string | null)?.trim() || "kg";
  const rawShelfLife = form.get("shelfLife");
  const rawShelfLifeUom = ((form.get("shelfLifeUom") as string | null)?.trim().toUpperCase() || "YEARS") as string;

  const parsed = materialSchema.safeParse({
    materialId: rawId,
    name: rawName,
    type: rawType,
    uom: rawUom,
    shelfLife: rawType === "RAW" ? 0 : rawShelfLife ?? 0,
    shelfLifeUom: rawShelfLifeUom,
  });

  if (!parsed.success) {
    const errorMsg = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join(", ");
    return { ok: false, message: errorMsg, system: "pathline" };
  }

  const active = form.get("active") === "true" || form.get("active") === "on";
  const comment = (form.get("comment") as string) || "Updated from Pathline ERP";
  const { materialId, name, type, uom, shelfLife, shelfLifeUom } = parsed.data;

  try {
    // 1. Update in local Database
    const updated = await prisma.material.update({
      where: { materialId },
      data: {
        name,
        type,
        uom,
        shelfLife,
        shelfLifeUom,
        active,
        reason: comment,
      },
    });

    // 2. Build Batchline payload
    const batchlinePayload = {
      materials: [
        {
          material_id: updated.materialId,
          material_name: updated.name,
          material_type: formatMaterialTypeForBatchline(updated.type),
          material_uom: updated.uom,
          shelf_life: updated.shelfLife,
          shelf_life_uom: formatShelfLifeUomForBatchline(updated.shelfLifeUom),
          comment: comment,
          active: updated.active,
          reason: "ERP Interface",
        },
      ],
    };

    // 3. Call external Batchline API
    let responseData: any = null;
    let responseStatus = 200;
    let requestMethod = "PUT";

    try {
      let res = await fetch(BATCHLINE_MATERIAL_UPDATE_API_URL, {
        method: requestMethod,
        headers: {
          "x-api-key": BATCHLINE_API_KEY,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(batchlinePayload),
        cache: "no-store",
      });

      if (res.status === 405) {
        requestMethod = "POST";
        res = await fetch(BATCHLINE_MATERIAL_UPDATE_API_URL, {
          method: requestMethod,
          headers: {
            "x-api-key": BATCHLINE_API_KEY,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(batchlinePayload),
          cache: "no-store",
        });
      }

      responseStatus = res.status;
      try {
        responseData = await res.json();
      } catch {
        responseData = { status: res.statusText };
      }
    } catch (apiErr) {
      console.error("External Batchline API update error:", apiErr);
      responseData = { error: apiErr instanceof Error ? apiErr.message : "API call failed" };
      responseStatus = 502;
    }

    // 4. Log integration message
    await prisma.integrationMessage.create({
      data: {
        direction: "OUTBOUND",
        endpoint: "/api/v1/material/update",
        method: requestMethod,
        entityType: "material",
        entityRef: materialId,
        status: responseStatus >= 200 && responseStatus < 300 ? "DELIVERED" : "FAILED",
        httpStatus: responseStatus,
        payload: batchlinePayload as any,
        response: responseData as any,
      },
    });

    revalidatePath("/materials");
    return {
      ok: true,
      message: `Updated ${materialId} → synced to Batchline`,
      system: "batchline",
    };
  } catch (e) {
    console.error("Failed to update material:", e);
    return {
      ok: false,
      message: "Failed to update material",
      system: "pathline",
    };
  }
}

interface BatchlineMaterialItem {
  material_id: string;
  material_name: string;
  material_type: string;
  material_uom: string;
  shelf_life: number | string;
  shelf_life_uom: string;
  comment: string;
  active: boolean;
  create_date: string;
  update_date: string;
}

interface BatchlineMaterialResponse {
  total_count: number;
  page_number: number;
  total_pages: number;
  items: BatchlineMaterialItem[];
}

function mapMaterialType(typeStr?: string | null): MaterialType {
  const norm = (typeStr || "").trim().toUpperCase();
  if (norm.includes("INTERMEDIATE")) return MaterialType.INTERMEDIATE;
  if (norm.includes("PRODUCT")) return MaterialType.PRODUCT;
  return MaterialType.RAW;
}

function mapShelfLifeUnit(uomStr?: string | null): ShelfLifeUom {
  const norm = (uomStr || "").trim().toUpperCase();
  if (norm.includes("MONTH")) return ShelfLifeUom.MONTHS;
  if (norm.includes("DAY")) return ShelfLifeUom.DAYS;
  if (norm.includes("HOUR")) return ShelfLifeUom.HOURS;
  if (norm.includes("MINUTE")) return ShelfLifeUom.MINUTES;
  return ShelfLifeUom.YEARS;
}

export async function syncMaterialsFromBatchline(): Promise<ActionResult> {
  try {
    let currentPage = 1;
    let totalPages = 1;
    let totalSynced = 0;
    let totalCount = 0;

    while (currentPage <= totalPages) {
      // const url = `${BATCHLINE_MATERIAL_API_URL}?material_id=1IFDCCA001`;
      // const url = `${BATCHLINE_MATERIAL_API_URL}?material_type=Intermediate`;
      const url = `${BATCHLINE_MATERIAL_API_URL}?page_number=${currentPage}`;
      const response = await fetch(url, {
        method: "GET",
        headers: {
          "x-api-key": BATCHLINE_API_KEY,
          "Content-Type": "application/json",
        },
        cache: "no-store",
      });

      if (!response.ok) {
        throw new Error(`External API failed: ${response.status} ${response.statusText}`);
      }

      const data: BatchlineMaterialResponse = await response.json();
      if (typeof data.total_pages === "number") {
        totalPages = data.total_pages;
      }
      if (typeof data.total_count === "number") {
        totalCount = data.total_count;
      }

      const items = data.items || [];
      if (items.length === 0) {
        currentPage++;
        continue;
      }

      // 1. Extract all incoming material IDs
      const incomingIds = items.map((item) => item.material_id).filter(Boolean);

      // 2. Fetch existing materials matching these IDs
      const existingMaterials = await prisma.material.findMany({
        where: { materialId: { in: incomingIds } },
      });

      // 3. Quick lookup dictionary in memory
      const existingMap = new Map(existingMaterials.map((mat) => [mat.materialId, mat]));

      // 4. Sort items into creates and updates in memory
      const createsToMake = [];
      const updatesToMake = [];

      for (const item of items) {
        if (!item.material_id) continue;
        const mappedType = mapMaterialType(item.material_type);
        const mappedUnit = mapShelfLifeUnit(item.shelf_life_uom);
        const mappedShelfLife = Number(item.shelf_life) || 0;
        const mappedDescription = item.comment || null;
        const isActive = typeof item.active === "boolean" ? item.active : true;

        const existing = existingMap.get(item.material_id);

        if (!existing) {
          createsToMake.push({
            materialId: item.material_id,
            name: item.material_name || item.material_id,
            uom: item.material_uom || "kg",
            type: mappedType,
            shelfLife: mappedShelfLife,
            shelfLifeUom: mappedUnit,
            active: isActive,
            reason: mappedDescription,
          });
        } else {
          const hasChanged =
            existing.name !== item.material_name ||
            existing.uom !== item.material_uom ||
            existing.type !== mappedType ||
            existing.shelfLife !== mappedShelfLife ||
            existing.shelfLifeUom !== mappedUnit ||
            existing.active !== isActive ||
            (mappedDescription && existing.reason !== mappedDescription);

          if (hasChanged) {
            updatesToMake.push(
              prisma.material.update({
                where: { id: existing.id },
                data: {
                  name: item.material_name || existing.name,
                  uom: item.material_uom || existing.uom,
                  type: mappedType,
                  shelfLife: mappedShelfLife,
                  shelfLifeUom: mappedUnit,
                  active: isActive,
                  reason: mappedDescription ?? existing.reason,
                },
              }),
            );
          }
        }
      }

      // 5. Execute DB writes efficiently
      if (createsToMake.length > 0) {
        await prisma.material.createMany({
          data: createsToMake,
          skipDuplicates: true,
        });
      }

      if (updatesToMake.length > 0) {
        await Promise.all(updatesToMake);
      }

      totalSynced += createsToMake.length + updatesToMake.length;
      currentPage++;
    }

    // 6. Log integration message
    await prisma.integrationMessage.create({
      data: {
        direction: "INBOUND",
        endpoint: "/api/v1/material/get",
        method: "GET",
        entityType: "material",
        status: "DELIVERED",
        httpStatus: 200,
        payload: { pages_fetched: currentPage - 1 } as any,
        response: { totalSynced, totalCount } as any,
      },
    });

    revalidatePath("/materials");

    return {
      ok: true,
      message:
        totalSynced > 0
          ? `Synced ${totalSynced} material(s) from Batchline`
          : totalCount > 0
            ? `All ${totalCount} materials from Batchline are up-to-date`
            : "Sync complete: materials are up-to-date",
      system: "batchline",
    };
  } catch (e) {
    console.error("Batchline material sync error:", e);
    return {
      ok: false,
      message: e instanceof Error ? e.message : "Failed to sync materials from Batchline",
      system: "batchline",
    };
  }
}

