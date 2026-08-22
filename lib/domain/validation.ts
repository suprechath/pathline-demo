// zod schemas shared by the wizard (client) and the Server Actions.
// Includes the one rule the relational DB cannot express:
// a BOM line's assigned lot quantities must SUM to the BOM quantity.
import { z } from "zod";

export const materialSchema = z.object({
  materialId: z.string().min(1).max(50).regex(/^[A-Za-z0-9-_./ ]+$/, "alphanumeric, dash, underscore, dot only"),
  name: z.string().min(1).max(100),
  type: z.enum(["RAW", "INTERMEDIATE", "PRODUCT"]),
  uom: z.string().min(1).max(20),
  shelfLife: z.coerce.number().int().min(0),
  shelfLifeUom: z.enum(["YEARS", "MONTHS", "DAYS", "HOURS", "MINUTES"]),
}).refine((m) => (m.type === "RAW" ? m.shelfLife === 0 : m.shelfLife >= 0), {
  message: "RAW shelf life must be 0; INTERMEDIATE/PRODUCT must be a non-negative integer",
  path: ["shelfLife"],
});

export const lotSchema = z.object({
  lotId: z.string().min(1).max(20),
  materialId: z.string().min(1),
  quantity: z.coerce.number().positive(),
  location: z.string().max(40).optional(),
  expiry: z.string().optional(),
});

export const orderSchema = z.object({
  orderNo: z.string().min(1).max(20),
  productMaterialId: z.string().min(1),
  size: z.coerce.number().positive(),
  uom: z.string().min(1).max(10),
  planStart: z.string().min(1),
  planEnd: z.string().min(1),
  stageName: z.string().min(1),
});

export const assignmentSchema = z.object({
  bomLineId: z.string(),
  required: z.number(),
  lots: z.array(z.object({ lotId: z.string(), quantity: z.number().nonnegative() })),
});

// The lot-sum-equals-BOM rule.
export function lineBalanced(required: number, lots: { quantity: number }[]) {
  const sum = lots.reduce((s, l) => s + l.quantity, 0);
  return Math.abs(sum - required) < 1e-6;
}

export function allLinesBalanced(lines: { required: number; lots: { quantity: number }[] }[]) {
  return lines.length > 0 && lines.every((l) => lineBalanced(l.required, l.lots));
}
