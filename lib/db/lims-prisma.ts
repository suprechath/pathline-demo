import { PrismaClient } from ".prisma/lims-client";

// Standalone client for the Assayline LIMS database. It is deliberately a
// SEPARATE client + connection from the ERP's `prisma` — the two systems do
// not share a schema, mirroring the real EBR → LIMS → EBR decoupling.
const globalForLims = globalThis as unknown as { limsPrisma?: PrismaClient };

export const limsPrisma =
  globalForLims.limsPrisma ??
  new PrismaClient({ log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"] });

if (process.env.NODE_ENV !== "production") globalForLims.limsPrisma = limsPrisma;
