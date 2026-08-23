import { PrismaClient, Prisma } from "@prisma/client";

const prisma = new PrismaClient();
const D = (n: number | string) => new Prisma.Decimal(n);

async function main() {
  console.log("Seeding 15 master recipes with associated materials...");

  // Materials map helper
  const materialsToEnsure = [
    // Existing & Additional Products
    { materialId: "PARA-500", name: "Paracetamol 500mg Tablet", type: "PRODUCT" as const, uom: "ea", shelfLife: 3 },
    { materialId: "IBU-200", name: "Ibuprofen 200mg Tablet", type: "PRODUCT" as const, uom: "ea", shelfLife: 3 },
    { materialId: "IBU-400", name: "Ibuprofen 400mg Forte Tablet", type: "PRODUCT" as const, uom: "ea", shelfLife: 3 },
    { materialId: "AMOX-500", name: "Amoxicillin 500mg Capsule", type: "PRODUCT" as const, uom: "ea", shelfLife: 2 },
    { materialId: "AMOX-CLAV-625", name: "Co-Amoxiclav 625mg Tablet", type: "PRODUCT" as const, uom: "ea", shelfLife: 2 },
    { materialId: "MET-500", name: "Metformin HCl 500mg ER Tablet", type: "PRODUCT" as const, uom: "ea", shelfLife: 3 },
    { materialId: "MET-850", name: "Metformin HCl 850mg Tablet", type: "PRODUCT" as const, uom: "ea", shelfLife: 3 },
    { materialId: "ATOR-20", name: "Atorvastatin 20mg Tablet", type: "PRODUCT" as const, uom: "ea", shelfLife: 2 },
    { materialId: "OMEP-20", name: "Omeprazole 20mg DR Capsule", type: "PRODUCT" as const, uom: "ea", shelfLife: 2 },
    { materialId: "LOS-50", name: "Losartan Potassium 50mg Tablet", type: "PRODUCT" as const, uom: "ea", shelfLife: 3 },
    { materialId: "CET-10", name: "Cetirizine 10mg Film Tablet", type: "PRODUCT" as const, uom: "ea", shelfLife: 3 },
    { materialId: "AZITH-500", name: "Azithromycin 500mg Tablet", type: "PRODUCT" as const, uom: "ea", shelfLife: 2 },
    { materialId: "PANT-40", name: "Pantoprazole 40mg DR Tablet", type: "PRODUCT" as const, uom: "ea", shelfLife: 3 },
    { materialId: "CIPRO-500", name: "Ciprofloxacin 500mg Tablet", type: "PRODUCT" as const, uom: "ea", shelfLife: 3 },

    // Intermediates
    { materialId: "PARA-BLEND", name: "Paracetamol Blend", type: "INTERMEDIATE" as const, uom: "kg", shelfLife: 6 },
    { materialId: "IBU-GRAN", name: "Ibuprofen Granulate", type: "INTERMEDIATE" as const, uom: "kg", shelfLife: 6 },
    { materialId: "IBU-GRAN-400", name: "Ibuprofen 400 Granulate", type: "INTERMEDIATE" as const, uom: "kg", shelfLife: 6 },
    { materialId: "AMOX-BLEND", name: "Amoxicillin Premix", type: "INTERMEDIATE" as const, uom: "kg", shelfLife: 4 },
    { materialId: "CLAV-GRAN", name: "Clavulanate Granules", type: "INTERMEDIATE" as const, uom: "kg", shelfLife: 4 },
    { materialId: "MET-GRAN", name: "Metformin ER Granules", type: "INTERMEDIATE" as const, uom: "kg", shelfLife: 6 },
    { materialId: "MET-GRAN-850", name: "Metformin 850 Granules", type: "INTERMEDIATE" as const, uom: "kg", shelfLife: 6 },
    { materialId: "ATOR-CORE", name: "Atorvastatin Tablet Cores", type: "INTERMEDIATE" as const, uom: "ea", shelfLife: 6 },
    { materialId: "OMEP-PELLET", name: "Omeprazole Enteric Pellets", type: "INTERMEDIATE" as const, uom: "kg", shelfLife: 6 },
    { materialId: "LOS-BLEND", name: "Losartan Final Blend", type: "INTERMEDIATE" as const, uom: "kg", shelfLife: 6 },
    { materialId: "CET-CORE", name: "Cetirizine Core Tablets", type: "INTERMEDIATE" as const, uom: "ea", shelfLife: 6 },
    { materialId: "AZITH-GRAN", name: "Azithromycin Granules", type: "INTERMEDIATE" as const, uom: "kg", shelfLife: 6 },
    { materialId: "PANT-CORE", name: "Pantoprazole Core Tablets", type: "INTERMEDIATE" as const, uom: "ea", shelfLife: 6 },
    { materialId: "CIPRO-GRAN", name: "Ciprofloxacin Granules", type: "INTERMEDIATE" as const, uom: "kg", shelfLife: 6 },

    // Raw Materials / APIs / Excipients
    { materialId: "PARA-API", name: "Paracetamol API", type: "RAW" as const, uom: "kg", shelfLife: 0 },
    { materialId: "IBU-API", name: "Ibuprofen API", type: "RAW" as const, uom: "kg", shelfLife: 0 },
    { materialId: "AMOX-TRI", name: "Amoxicillin Trihydrate API", type: "RAW" as const, uom: "kg", shelfLife: 0 },
    { materialId: "POT-CLAV", name: "Potassium Clavulanate API", type: "RAW" as const, uom: "kg", shelfLife: 0 },
    { materialId: "MET-API", name: "Metformin Hydrochloride API", type: "RAW" as const, uom: "kg", shelfLife: 0 },
    { materialId: "ATOR-CAL", name: "Atorvastatin Calcium API", type: "RAW" as const, uom: "kg", shelfLife: 0 },
    { materialId: "OMEP-API", name: "Omeprazole API", type: "RAW" as const, uom: "kg", shelfLife: 0 },
    { materialId: "LOS-POT", name: "Losartan Potassium API", type: "RAW" as const, uom: "kg", shelfLife: 0 },
    { materialId: "CET-DIHCL", name: "Cetirizine DiHCl API", type: "RAW" as const, uom: "kg", shelfLife: 0 },
    { materialId: "AZITH-DIH", name: "Azithromycin Dihydrate API", type: "RAW" as const, uom: "kg", shelfLife: 0 },
    { materialId: "PANT-SOD", name: "Pantoprazole Sodium API", type: "RAW" as const, uom: "kg", shelfLife: 0 },
    { materialId: "CIPRO-HCL", name: "Ciprofloxacin HCl API", type: "RAW" as const, uom: "kg", shelfLife: 0 },
    { materialId: "LACT-MONO", name: "Lactose Monohydrate", type: "RAW" as const, uom: "kg", shelfLife: 0 },
    { materialId: "MAG-STE", name: "Magnesium Stearate", type: "RAW" as const, uom: "kg", shelfLife: 0 },
    { materialId: "CROSCAR", name: "Croscarmellose Sodium", type: "RAW" as const, uom: "kg", shelfLife: 0 },
    { materialId: "MICRO-CEL", name: "Microcrystalline Cellulose PH-102", type: "RAW" as const, uom: "kg", shelfLife: 0 },
    { materialId: "POVIDONE", name: "Povidone K30", type: "RAW" as const, uom: "kg", shelfLife: 0 },
    { materialId: "SIL-DIOX", name: "Colloidal Silicon Dioxide", type: "RAW" as const, uom: "kg", shelfLife: 0 },
    { materialId: "HPMC-K100", name: "Hypromellose K100M", type: "RAW" as const, uom: "kg", shelfLife: 0 },
    { materialId: "OPADRY-W", name: "Opadry II White Film Coat", type: "RAW" as const, uom: "kg", shelfLife: 0 },
    { materialId: "EUDRAGIT-L", name: "Eudragit L30 D-55", type: "RAW" as const, uom: "kg", shelfLife: 0 },
    { materialId: "TALC-PH", name: "Purified Talc Pharma Grade", type: "RAW" as const, uom: "kg", shelfLife: 0 },
    { materialId: "GEL-CAP-0", name: "Hard Gelatin Capsules Size 0", type: "RAW" as const, uom: "ea", shelfLife: 0 },
    { materialId: "GEL-CAP-2", name: "Hard Gelatin Capsules Size 2", type: "RAW" as const, uom: "ea", shelfLife: 0 },
  ];

  for (const m of materialsToEnsure) {
    await prisma.material.upsert({
      where: { materialId: m.materialId },
      update: { name: m.name, type: m.type, uom: m.uom },
      create: {
        materialId: m.materialId,
        name: m.name,
        type: m.type,
        uom: m.uom,
        shelfLife: m.shelfLife,
        active: true,
      },
    });
  }

  const matRows = await prisma.material.findMany();
  const matMap = new Map<string, typeof matRows[0]>();
  for (const m of matRows) {
    matMap.set(m.materialId, m);
  }

  const recipes = [
    {
      recipeId: "RCP-BLEND-01",
      version: 2,
      status: "APPROVED" as const,
      baseSize: 300,
      uom: "kg",
      yieldPct: 99,
      note: "Standard direct-blend route.",
      productId: "PARA-BLEND",
      stages: [
        {
          name: "Blending",
          seq: 1,
          outputId: "PARA-BLEND",
          outputQty: 300,
          uom: "kg",
          subStages: [{ name: "Pre-mix", seq: 1 }, { name: "Final blend", seq: 2 }],
          bom: [
            { bomId: "BOM-BLEND-01", materialId: "PARA-API", qty: 150, uom: "kg" },
            { bomId: "BOM-BLEND-02", materialId: "LACT-MONO", qty: 145, uom: "kg" },
            { bomId: "BOM-BLEND-03", materialId: "MAG-STE", qty: 5, uom: "kg" },
          ],
        },
      ],
    },
    {
      recipeId: "RCP-IBU-01",
      version: 1,
      status: "APPROVED" as const,
      baseSize: 400000,
      uom: "ea",
      yieldPct: 96,
      note: "Wet granulation → compression route for 200mg.",
      productId: "IBU-200",
      stages: [
        {
          name: "Granulation",
          seq: 1,
          outputId: "IBU-GRAN",
          outputQty: 88,
          uom: "kg",
          subStages: [{ name: "Wet mix", seq: 1 }, { name: "Dry & mill", seq: 2 }],
          bom: [
            { bomId: "BOM-IBU-G01", materialId: "IBU-API", qty: 80, uom: "kg" },
            { bomId: "BOM-IBU-G02", materialId: "LACT-MONO", qty: 6, uom: "kg" },
            { bomId: "BOM-IBU-G03", materialId: "CROSCAR", qty: 2, uom: "kg" },
          ],
        },
        {
          name: "Compression",
          seq: 2,
          outputId: "IBU-200",
          outputQty: 400000,
          uom: "ea",
          subStages: [{ name: "Rotary Press", seq: 1 }, { name: "Dedust & De-metal", seq: 2 }],
          bom: [
            { bomId: "BOM-IBU-C01", materialId: "IBU-GRAN", qty: 88, uom: "kg" },
            { bomId: "BOM-IBU-C02", materialId: "MAG-STE", qty: 1.5, uom: "kg" },
          ],
        },
      ],
    },
    {
      recipeId: "RCP-IBU-02",
      version: 1,
      status: "APPROVED" as const,
      baseSize: 250000,
      uom: "ea",
      yieldPct: 98,
      note: "High-potency 400mg formulation with film coating.",
      productId: "IBU-400",
      stages: [
        {
          name: "Fluid Bed Granulation",
          seq: 1,
          outputId: "IBU-GRAN-400",
          outputQty: 110,
          uom: "kg",
          subStages: [{ name: "Binder Spray", seq: 1 }, { name: "Fluid Drying", seq: 2 }],
          bom: [
            { bomId: "BOM-IBU4-01", materialId: "IBU-API", qty: 100, uom: "kg" },
            { bomId: "BOM-IBU4-02", materialId: "MICRO-CEL", qty: 8, uom: "kg" },
            { bomId: "BOM-IBU4-03", materialId: "POVIDONE", qty: 2, uom: "kg" },
          ],
        },
        {
          name: "Compression & Coating",
          seq: 2,
          outputId: "IBU-400",
          outputQty: 250000,
          uom: "ea",
          subStages: [{ name: "Core Compression", seq: 1 }, { name: "Film Coating", seq: 2 }],
          bom: [
            { bomId: "BOM-IBU4-04", materialId: "IBU-GRAN-400", qty: 110, uom: "kg" },
            { bomId: "BOM-IBU4-05", materialId: "MAG-STE", qty: 1.2, uom: "kg" },
            { bomId: "BOM-IBU4-06", materialId: "OPADRY-W", qty: 4.5, uom: "kg" },
          ],
        },
      ],
    },
    {
      recipeId: "RCP-PARA-500",
      version: 3,
      status: "APPROVED" as const,
      baseSize: 600000,
      uom: "ea",
      yieldPct: 99.2,
      note: "Direct high-speed compression from Paracetamol Blend.",
      productId: "PARA-500",
      stages: [
        {
          name: "Compression",
          seq: 1,
          outputId: "PARA-500",
          outputQty: 600000,
          uom: "ea",
          subStages: [{ name: "Core pressing", seq: 1 }, { name: "Metal check", seq: 2 }],
          bom: [
            { bomId: "BOM-P500-01", materialId: "PARA-BLEND", qty: 300, uom: "kg" },
            { bomId: "BOM-P500-02", materialId: "TALC-PH", qty: 3, uom: "kg" },
          ],
        },
      ],
    },
    {
      recipeId: "RCP-AMOX-500",
      version: 1,
      status: "APPROVED" as const,
      baseSize: 200000,
      uom: "ea",
      yieldPct: 97.5,
      note: "Hard gelatin capsule encapsulation.",
      productId: "AMOX-500",
      stages: [
        {
          name: "Powder Blending",
          seq: 1,
          outputId: "AMOX-BLEND",
          outputQty: 115,
          uom: "kg",
          subStages: [{ name: "De-lumping", seq: 1 }, { name: "Tumble blend", seq: 2 }],
          bom: [
            { bomId: "BOM-AMX-01", materialId: "AMOX-TRI", qty: 100, uom: "kg" },
            { bomId: "BOM-AMX-02", materialId: "SIL-DIOX", qty: 1, uom: "kg" },
            { bomId: "BOM-AMX-03", materialId: "MAG-STE", qty: 14, uom: "kg" },
          ],
        },
        {
          name: "Capsule Filling",
          seq: 2,
          outputId: "AMOX-500",
          outputQty: 200000,
          uom: "ea",
          subStages: [{ name: "Dosing & Tamping", seq: 1 }, { name: "Capsule Polishing", seq: 2 }],
          bom: [
            { bomId: "BOM-AMX-04", materialId: "AMOX-BLEND", qty: 115, uom: "kg" },
            { bomId: "BOM-AMX-05", materialId: "GEL-CAP-0", qty: 200000, uom: "ea" },
          ],
        },
      ],
    },
    {
      recipeId: "RCP-AMOX-CLAV",
      version: 2,
      status: "APPROVED" as const,
      baseSize: 150000,
      uom: "ea",
      yieldPct: 95.8,
      note: "Dry compaction route under low humidity RH < 20%.",
      productId: "AMOX-CLAV-625",
      stages: [
        {
          name: "Dry Roller Compaction",
          seq: 1,
          outputId: "CLAV-GRAN",
          outputQty: 105,
          uom: "kg",
          subStages: [{ name: "Pre-blend", seq: 1 }, { name: "Chilsonator Compacting", seq: 2 }],
          bom: [
            { bomId: "BOM-AC-01", materialId: "AMOX-TRI", qty: 75, uom: "kg" },
            { bomId: "BOM-AC-02", materialId: "POT-CLAV", qty: 25, uom: "kg" },
            { bomId: "BOM-AC-03", materialId: "SIL-DIOX", qty: 5, uom: "kg" },
          ],
        },
        {
          name: "Compression & Coating",
          seq: 2,
          outputId: "AMOX-CLAV-625",
          outputQty: 150000,
          uom: "ea",
          subStages: [{ name: "Tablet Compression", seq: 1 }, { name: "Moisture-barrier Coat", seq: 2 }],
          bom: [
            { bomId: "BOM-AC-04", materialId: "CLAV-GRAN", qty: 105, uom: "kg" },
            { bomId: "BOM-AC-05", materialId: "MAG-STE", qty: 1.5, uom: "kg" },
            { bomId: "BOM-AC-06", materialId: "OPADRY-W", qty: 4, uom: "kg" },
          ],
        },
      ],
    },
    {
      recipeId: "RCP-MET-500",
      version: 1,
      status: "APPROVED" as const,
      baseSize: 300000,
      uom: "ea",
      yieldPct: 98.4,
      note: "Extended release hydrophilic matrix formulation.",
      productId: "MET-500",
      stages: [
        {
          name: "High Shear Granulation",
          seq: 1,
          outputId: "MET-GRAN",
          outputQty: 160,
          uom: "kg",
          subStages: [{ name: "Dry mix", seq: 1 }, { name: "Hydrophilic binder spray", seq: 2 }],
          bom: [
            { bomId: "BOM-MET5-01", materialId: "MET-API", qty: 150, uom: "kg" },
            { bomId: "BOM-MET5-02", materialId: "HPMC-K100", qty: 7, uom: "kg" },
            { bomId: "BOM-MET5-03", materialId: "POVIDONE", qty: 3, uom: "kg" },
          ],
        },
        {
          name: "Matrix Compression",
          seq: 2,
          outputId: "MET-500",
          outputQty: 300000,
          uom: "ea",
          subStages: [{ name: "Compression", seq: 1 }],
          bom: [
            { bomId: "BOM-MET5-04", materialId: "MET-GRAN", qty: 160, uom: "kg" },
            { bomId: "BOM-MET5-05", materialId: "MAG-STE", qty: 1.5, uom: "kg" },
          ],
        },
      ],
    },
    {
      recipeId: "RCP-MET-850",
      version: 1,
      status: "APPROVED" as const,
      baseSize: 200000,
      uom: "ea",
      yieldPct: 98.9,
      note: "High payload immediate release tablet.",
      productId: "MET-850",
      stages: [
        {
          name: "Fluid Bed Granulation",
          seq: 1,
          outputId: "MET-GRAN-850",
          outputQty: 180,
          uom: "kg",
          subStages: [{ name: "Granulate", seq: 1 }, { name: "Sieve & Mill", seq: 2 }],
          bom: [
            { bomId: "BOM-MET8-01", materialId: "MET-API", qty: 170, uom: "kg" },
            { bomId: "BOM-MET8-02", materialId: "MICRO-CEL", qty: 8, uom: "kg" },
            { bomId: "BOM-MET8-03", materialId: "POVIDONE", qty: 2, uom: "kg" },
          ],
        },
        {
          name: "Rotary Compression",
          seq: 2,
          outputId: "MET-850",
          outputQty: 200000,
          uom: "ea",
          subStages: [{ name: "High Speed Tableting", seq: 1 }],
          bom: [
            { bomId: "BOM-MET8-04", materialId: "MET-GRAN-850", qty: 180, uom: "kg" },
            { bomId: "BOM-MET8-05", materialId: "MAG-STE", qty: 1.8, uom: "kg" },
            { bomId: "BOM-MET8-06", materialId: "TALC-PH", qty: 1, uom: "kg" },
          ],
        },
      ],
    },
    {
      recipeId: "RCP-ATOR-20",
      version: 2,
      status: "APPROVED" as const,
      baseSize: 500000,
      uom: "ea",
      yieldPct: 97.8,
      note: "Direct compression followed by aesthetic white film coating.",
      productId: "ATOR-20",
      stages: [
        {
          name: "Direct Blend & Core Compression",
          seq: 1,
          outputId: "ATOR-CORE",
          outputQty: 500000,
          uom: "ea",
          subStages: [{ name: "V-cone blend", seq: 1 }, { name: "Tablet press", seq: 2 }],
          bom: [
            { bomId: "BOM-AT20-01", materialId: "ATOR-CAL", qty: 10.5, uom: "kg" },
            { bomId: "BOM-AT20-02", materialId: "LACT-MONO", qty: 35, uom: "kg" },
            { bomId: "BOM-AT20-03", materialId: "CROSCAR", qty: 3, uom: "kg" },
            { bomId: "BOM-AT20-04", materialId: "MAG-STE", qty: 0.8, uom: "kg" },
          ],
        },
        {
          name: "Pan Coating",
          seq: 2,
          outputId: "ATOR-20",
          outputQty: 500000,
          uom: "ea",
          subStages: [{ name: "Film coat spray", seq: 1 }, { name: "Curing & cooling", seq: 2 }],
          bom: [
            { bomId: "BOM-AT20-05", materialId: "ATOR-CORE", qty: 500000, uom: "ea" },
            { bomId: "BOM-AT20-06", materialId: "OPADRY-W", qty: 2.2, uom: "kg" },
          ],
        },
      ],
    },
    {
      recipeId: "RCP-OMEP-20",
      version: 1,
      status: "APPROVED" as const,
      baseSize: 350000,
      uom: "ea",
      yieldPct: 96.2,
      note: "Multi-particulate enteric coated pellets encapsulated in size 2 shells.",
      productId: "OMEP-20",
      stages: [
        {
          name: "Enteric Layering",
          seq: 1,
          outputId: "OMEP-PELLET",
          outputQty: 85,
          uom: "kg",
          subStages: [{ name: "Drug layering", seq: 1 }, { name: "Enteric polymer coat", seq: 2 }],
          bom: [
            { bomId: "BOM-OMP-01", materialId: "OMEP-API", qty: 7, uom: "kg" },
            { bomId: "BOM-OMP-02", materialId: "LACT-MONO", qty: 65, uom: "kg" },
            { bomId: "BOM-OMP-03", materialId: "EUDRAGIT-L", qty: 13, uom: "kg" },
          ],
        },
        {
          name: "Pellet Encapsulation",
          seq: 2,
          outputId: "OMEP-20",
          outputQty: 350000,
          uom: "ea",
          subStages: [{ name: "Pellet dosing", seq: 1 }],
          bom: [
            { bomId: "BOM-OMP-04", materialId: "OMEP-PELLET", qty: 85, uom: "kg" },
            { bomId: "BOM-OMP-05", materialId: "GEL-CAP-2", qty: 350000, uom: "ea" },
          ],
        },
      ],
    },
    {
      recipeId: "RCP-LOS-50",
      version: 1,
      status: "APPROVED" as const,
      baseSize: 450000,
      uom: "ea",
      yieldPct: 99.1,
      note: "Direct blend and compression for 50mg tablets.",
      productId: "LOS-50",
      stages: [
        {
          name: "Dry Blending",
          seq: 1,
          outputId: "LOS-BLEND",
          outputQty: 68,
          uom: "kg",
          subStages: [{ name: "Screening", seq: 1 }, { name: "Bin blending", seq: 2 }],
          bom: [
            { bomId: "BOM-LOS-01", materialId: "LOS-POT", qty: 22.5, uom: "kg" },
            { bomId: "BOM-LOS-02", materialId: "LACT-MONO", qty: 25, uom: "kg" },
            { bomId: "BOM-LOS-03", materialId: "MICRO-CEL", qty: 20, uom: "kg" },
          ],
        },
        {
          name: "Tableting",
          seq: 2,
          outputId: "LOS-50",
          outputQty: 450000,
          uom: "ea",
          subStages: [{ name: "Compression", seq: 1 }],
          bom: [
            { bomId: "BOM-LOS-04", materialId: "LOS-BLEND", qty: 68, uom: "kg" },
            { bomId: "BOM-LOS-05", materialId: "MAG-STE", qty: 0.9, uom: "kg" },
          ],
        },
      ],
    },
    {
      recipeId: "RCP-CET-10",
      version: 1,
      status: "APPROVED" as const,
      baseSize: 500000,
      uom: "ea",
      yieldPct: 98.7,
      note: "Low-dose active blend, high-speed rotary press and film coating.",
      productId: "CET-10",
      stages: [
        {
          name: "Core Compression",
          seq: 1,
          outputId: "CET-CORE",
          outputQty: 500000,
          uom: "ea",
          subStages: [{ name: "Geometric mixing", seq: 1 }, { name: "Core compression", seq: 2 }],
          bom: [
            { bomId: "BOM-CET-01", materialId: "CET-DIHCL", qty: 5, uom: "kg" },
            { bomId: "BOM-CET-02", materialId: "LACT-MONO", qty: 35, uom: "kg" },
            { bomId: "BOM-CET-03", materialId: "SIL-DIOX", qty: 0.8, uom: "kg" },
            { bomId: "BOM-CET-04", materialId: "MAG-STE", qty: 0.7, uom: "kg" },
          ],
        },
        {
          name: "Film Coating",
          seq: 2,
          outputId: "CET-10",
          outputQty: 500000,
          uom: "ea",
          subStages: [{ name: "Coating suspension prep", seq: 1 }, { name: "Spray coating", seq: 2 }],
          bom: [
            { bomId: "BOM-CET-05", materialId: "CET-CORE", qty: 500000, uom: "ea" },
            { bomId: "BOM-CET-06", materialId: "OPADRY-W", qty: 1.8, uom: "kg" },
          ],
        },
      ],
    },
    {
      recipeId: "RCP-AZITH-500",
      version: 2,
      status: "APPROVED" as const,
      baseSize: 180000,
      uom: "ea",
      yieldPct: 96.8,
      note: "Roller compaction and modified film coating.",
      productId: "AZITH-500",
      stages: [
        {
          name: "Roller Compaction",
          seq: 1,
          outputId: "AZITH-GRAN",
          outputQty: 105,
          uom: "kg",
          subStages: [{ name: "De-aeration & compacting", seq: 1 }, { name: "Oscillating granulator", seq: 2 }],
          bom: [
            { bomId: "BOM-AZT-01", materialId: "AZITH-DIH", qty: 90, uom: "kg" },
            { bomId: "BOM-AZT-02", materialId: "MICRO-CEL", qty: 12, uom: "kg" },
            { bomId: "BOM-AZT-03", materialId: "CROSCAR", qty: 3, uom: "kg" },
          ],
        },
        {
          name: "Compression & Coating",
          seq: 2,
          outputId: "AZITH-500",
          outputQty: 180000,
          uom: "ea",
          subStages: [{ name: "Oblong compression", seq: 1 }, { name: "Film coating", seq: 2 }],
          bom: [
            { bomId: "BOM-AZT-04", materialId: "AZITH-GRAN", qty: 105, uom: "kg" },
            { bomId: "BOM-AZT-05", materialId: "MAG-STE", qty: 1.4, uom: "kg" },
            { bomId: "BOM-AZT-06", materialId: "OPADRY-W", qty: 3.8, uom: "kg" },
          ],
        },
      ],
    },
    {
      recipeId: "RCP-PANT-40",
      version: 1,
      status: "APPROVED" as const,
      baseSize: 400000,
      uom: "ea",
      yieldPct: 95.5,
      note: "Alkaline stabilized core with double enteric protection.",
      productId: "PANT-40",
      stages: [
        {
          name: "Core Tableting",
          seq: 1,
          outputId: "PANT-CORE",
          outputQty: 400000,
          uom: "ea",
          subStages: [{ name: "Alkaline dry mix", seq: 1 }, { name: "Core pressing", seq: 2 }],
          bom: [
            { bomId: "BOM-PNT-01", materialId: "PANT-SOD", qty: 16, uom: "kg" },
            { bomId: "BOM-PNT-02", materialId: "LACT-MONO", qty: 28, uom: "kg" },
            { bomId: "BOM-PNT-03", materialId: "CROSCAR", qty: 2, uom: "kg" },
            { bomId: "BOM-PNT-04", materialId: "MAG-STE", qty: 0.6, uom: "kg" },
          ],
        },
        {
          name: "Enteric Coating",
          seq: 2,
          outputId: "PANT-40",
          outputQty: 400000,
          uom: "ea",
          subStages: [{ name: "Sub-coat application", seq: 1 }, { name: "Enteric coat application", seq: 2 }],
          bom: [
            { bomId: "BOM-PNT-05", materialId: "PANT-CORE", qty: 400000, uom: "ea" },
            { bomId: "BOM-PNT-06", materialId: "EUDRAGIT-L", qty: 5.5, uom: "kg" },
          ],
        },
      ],
    },
    {
      recipeId: "RCP-CIPRO-500",
      version: 1,
      status: "APPROVED" as const,
      baseSize: 220000,
      uom: "ea",
      yieldPct: 97.2,
      note: "High-load fluoroquinolone wet granulation and compression.",
      productId: "CIPRO-500",
      stages: [
        {
          name: "Wet Granulation",
          seq: 1,
          outputId: "CIPRO-GRAN",
          outputQty: 135,
          uom: "kg",
          subStages: [{ name: "Binder solution prep", seq: 1 }, { name: "Fluid bed granulation", seq: 2 }],
          bom: [
            { bomId: "BOM-CPR-01", materialId: "CIPRO-HCL", qty: 110, uom: "kg" },
            { bomId: "BOM-CPR-02", materialId: "MICRO-CEL", qty: 18, uom: "kg" },
            { bomId: "BOM-CPR-03", materialId: "POVIDONE", qty: 7, uom: "kg" },
          ],
        },
        {
          name: "Compression",
          seq: 2,
          outputId: "CIPRO-500",
          outputQty: 220000,
          uom: "ea",
          subStages: [{ name: "Lubrication blending", seq: 1 }, { name: "High-speed tableting", seq: 2 }],
          bom: [
            { bomId: "BOM-CPR-04", materialId: "CIPRO-GRAN", qty: 135, uom: "kg" },
            { bomId: "BOM-CPR-05", materialId: "SIL-DIOX", qty: 1.2, uom: "kg" },
            { bomId: "BOM-CPR-06", materialId: "MAG-STE", qty: 1.8, uom: "kg" },
          ],
        },
      ],
    },
  ];

  for (const r of recipes) {
    const prodMat = matMap.get(r.productId)!;

    // Check if recipe exists
    const existing = await prisma.recipe.findUnique({
      where: { recipeId: r.recipeId },
    });

    if (existing) {
      // Delete existing stages to rebuild cleanly
      await prisma.recipeStage.deleteMany({
        where: { recipeId: existing.id },
      });

      await prisma.recipe.update({
        where: { id: existing.id },
        data: {
          version: r.version,
          status: r.status,
          baseSize: D(r.baseSize),
          uom: r.uom,
          yieldPct: D(r.yieldPct),
          note: r.note,
          productMaterialId: prodMat.id,
          stages: {
            create: r.stages.map((s) => {
              const outMat = matMap.get(s.outputId)!;
              return {
                name: s.name,
                seq: s.seq,
                outputQty: D(s.outputQty),
                uom: s.uom,
                outputMaterialId: outMat.id,
                subStages: {
                  create: s.subStages.map((ss) => ({
                    name: ss.name,
                    seq: ss.seq,
                  })),
                },
                bomLines: {
                  create: s.bom.map((b) => {
                    const bMat = matMap.get(b.materialId)!;
                    return {
                      bomId: b.bomId,
                      quantity: D(b.qty),
                      uom: b.uom,
                      materialId: bMat.id,
                    };
                  }),
                },
              };
            }),
          },
        },
      });
      console.log(`Updated recipe ${r.recipeId}`);
    } else {
      await prisma.recipe.create({
        data: {
          recipeId: r.recipeId,
          version: r.version,
          status: r.status,
          baseSize: D(r.baseSize),
          uom: r.uom,
          yieldPct: D(r.yieldPct),
          note: r.note,
          productMaterialId: prodMat.id,
          stages: {
            create: r.stages.map((s) => {
              const outMat = matMap.get(s.outputId)!;
              return {
                name: s.name,
                seq: s.seq,
                outputQty: D(s.outputQty),
                uom: s.uom,
                outputMaterialId: outMat.id,
                subStages: {
                  create: s.subStages.map((ss) => ({
                    name: ss.name,
                    seq: ss.seq,
                  })),
                },
                bomLines: {
                  create: s.bom.map((b) => {
                    const bMat = matMap.get(b.materialId)!;
                    return {
                      bomId: b.bomId,
                      quantity: D(b.qty),
                      uom: b.uom,
                      materialId: bMat.id,
                    };
                  }),
                },
              };
            }),
          },
        },
      });
      console.log(`Created recipe ${r.recipeId}`);
    }
  }

  const count = await prisma.recipe.count();
  console.log(`Total recipes in DB: ${count}`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
