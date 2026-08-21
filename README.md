# Pathline ERP — Batchline integration PoC

A lightweight, database-backed demo ERP that tells the Batchline integration
story: a planner sets up master data and an order, sends it to Batchline, and
watches execution results return live. Built with **Next.js 16 (App Router)**,
**React 19**, **Prisma + PostgreSQL**, and **Tailwind CSS v4**.

> Not a production system. It has no auth and no deployment — it runs on one
> machine and resets cleanly between demos.

## Theme

Brown-white throughout. The two-system story is carried by two tones:
**espresso = Pathline (the ERP)**, **amber = Batchline (the plant)** — visible
in the topbar legend, Batchline actions, exceptions, and the payload panel.

## Quick start

```bash
docker compose up -d        # start Postgres 16 on localhost:5432
npm install
npx prisma migrate dev      # create tables from prisma/schema.prisma
npx prisma db seed          # load paracetamol master data + 2 orders
npm run lims:migrate        # create the standalone LIMS tables (schema=lims)
npm run lims:seed           # load QC specs + hold points
npm run dev                 # http://localhost:3000  (redirects to /orders)
```

### Reset between demos

```bash
docker compose down -v      # wipe the volume
docker compose up -d && npx prisma migrate dev && npx prisma db seed
```

## The demo narrative

1. **/materials** — create a material; it's logged as an outbound sync to Batchline (toast + `IntegrationMessage`).
2. **/inventory** — receive a lot; click a Lot ID for its signed movement ledger; use the ⋮ menu to **Issue stock** (Sale/QC/Scrap/Rejection/Adjustment/Quarantine/QC release — Rejection & Quarantine issue the whole lot, QC release returns it).
3. **/recipes** — browse master recipes (stage → output → BOM), create one, edit its header. Orders instantiate an approved recipe rather than defining stages by hand.
4. **/orders** — open the seeded **PO-2042**, confirm the lot sum bars balance, optionally **View API payload**, then **Send to Batchline** (assigned lots become reserved).
5. **/orders/PO-2042** — click **Simulate batch in Batchline**. The simulator POSTs webhook events to the real inbound route; status moves Planned → Started → Completed → (Review & close) Reviewed; the timeline streams instructions + a QA exception over SSE; reserved lots convert to consumed; yield calculates on completion.
6. **/lims** — Assayline LIMS (violet, its own database). In-process control hold points arrive from Batchline EBR; receive the sample, enter a measured value (evaluated live against the spec), then **Record & send to EBR** — an in-spec value releases the hold (batch resumes), out-of-spec fails it (batch held). **Simulate EBR request** fabricates a new inbound hold point.

## Screens

| Route | Purpose |
|---|---|
| `/materials` | Item master, create + activate/deactivate |
| `/inventory` | Lots, receive, issue stock, movement ledger, reserved/available |
| `/recipes` `/recipes/[id]` | Recipe master — list, detail (stages/sub-stages/BOM), create/edit |
| `/orders` `/orders/[orderNo]` | Process orders, 3-step wizard, drill-down, live execution |
| `/lims` | Assayline LIMS — IPC hold points, spec-gated result entry, EBR handshake (standalone DB) |

## Architecture

| Concern | Where |
|---|---|
| Data reads | Server Components → `lib/data/*` → Prisma |
| Data writes | Server Actions (`app/**/actions.ts`) → Prisma → `revalidatePath()` |
| View models | `lib/domain/mappers.ts` derives `sent`, per-line `uom`, `expired` (the 3NF-removed fields) |
| Validation | `lib/domain/validation.ts` — zod + the lot-sum-equals-BOM rule |
| Integration seam | `lib/batchline/*` — the only simulated part |
| Round trip | `sendToBatchline` → `simulateBatch` → `lib/batchline/simulator.ts` POSTs to `app/api/batchline/webhook/route.ts` → writes `ExecutionEvent` → `app/orders/[orderNo]/stream/route.ts` streams it back over SSE |

The webhook route and SSE stream are the **real** path; only the plant side
(`simulator.ts` / `client.ts`) is faked, so the PoC exercises an actual
outbound call and inbound webhook.

## Assayline LIMS (standalone)

The Quality module is a **separate system** with its own database, mirroring the
real EBR → LIMS → EBR decoupling — no foreign keys or shared enums with the ERP.
Batch/stage context is stored as plain strings exactly as they arrive from
Batchline.

| Concern | Where |
|---|---|
| Schema | `prisma/lims.schema.prisma` (own datasource `LIMS_DATABASE_URL`, own generated client) |
| Client | `lib/db/lims-prisma.ts` (separate `PrismaClient`) |
| Reads | `lib/data/lims.ts` — `getHoldPoints`, `evalVerdict`, `limsStats` |
| Writes | `app/lims/actions.ts` — `receiveHoldRequest`, `receiveSample`, `recordResult`, `simulateIncoming` |
| EBR inbound | `app/api/ebr/hold-request/route.ts` — EBR POSTs a hold-point test request |
| EBR return | `lib/batchline/ebr-client.ts` — `returnDisposition` (pass/fail back to EBR) |
| Tables | `QcSpecification → HoldPoint → QcResult` |

Recording a result computes the verdict, writes `QcResult`, updates the hold
status, and returns the disposition to the EBR — in one transaction.

## Data model

`prisma/schema.prisma` (PostgreSQL, normalized to 3NF). Order hierarchy:
`ProcessOrder → Stage → BomLine → LotAssignment → Lot`. `ExecutionEvent` is an
append-only stream mirroring the `batch_status.update` and `instruction.updated`
webhook feeds. `IntegrationMessage` logs every outbound call and inbound webhook.

## Project layout

```
app/            routes, server actions, SSE + webhook route handlers
components/     layout · ui · materials · inventory · orders
lib/db/         Prisma singleton
lib/data/       read queries (Server Components)
lib/domain/     view-model types, mappers, zod validation
lib/batchline/  wire contract, payload builders, outbound client, simulator
prisma/         schema.prisma + seed.ts
```

## Environment

`.env` (committed — trivial local creds, nothing deploys):

```
DATABASE_URL="postgresql://pathline:pathline@localhost:5432/pathline?schema=public"
LIMS_DATABASE_URL="postgresql://pathline:pathline@localhost:5432/pathline?schema=lims"
BATCHLINE_API_KEY="local-demo-key"
BASE_URL="http://localhost:3000"
```
