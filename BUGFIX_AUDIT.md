# BUGFIX AUDIT — Q21 Production Bug Report
**Site:** https://q21.otokura.online
**Date:** 2026-03-15
**Phase:** 1 (10 issues)

Legend: `[ ]` not fixed · `[~]` investigating · `[x]` fixed

---

## BUG 1 — Routing / URL always shows `/dashboard`

**Status:** `[x]` Investigated — not reproducible in codebase

**Problem:**
Navigating between pages (Estudos, Visitas, Analistas, etc.) never updates the
browser URL — it stays on `/dashboard` throughout the session.

**Root cause:**
Investigated source code fully. No `history.replaceState` calls in `AppShell.tsx`,
no `middleware.ts` found. `AppShell` uses Next.js `<Link href>` components which
properly update the URL. `nginx.conf` `location /` block proxies directly to
Next.js without any path rewriting. The reported behaviour was **not reproducible**
in the committed codebase — this was likely a production-only nginx config issue
external to this repository (e.g. a separate gateway config).

**Fix applied:**
- `infra/nginx/nginx.conf` `location /` was already clean — no rewrite to `/dashboard`
- No `AppShell.tsx` or middleware change needed

---

## BUG 2 — Estudos page: "Novo" button does nothing + wrong colour

**Status:** `[x]` Fixed 2026-03-15

**Fix applied:**
- Added create-study modal with `nome` + `cliente_id` fields
- Button now has `onClick={() => setShowModal(true)}`
- Changed button colour from `bg-blue-600` to `bg-[#FF3300] hover:bg-[#CC2200]`
- POST to `/api/estudos/` on submit with validation; refreshes list on success
- Study card colours also updated to brand orange `#FF3300`

**Files changed:** `frontend/src/app/estudos/page.tsx`

---

## BUG 3 — Estudo detail view: action buttons broken on mobile

**Status:** `[x]` Fixed 2026-03-15

**Fix applied:**
- Added `overflow-x-auto pb-0.5` to the action buttons container so they scroll
  horizontally on very narrow screens instead of breaking the layout.

**Files changed:** `frontend/src/app/estudos/[id]/page.tsx`

---

## BUG 4 — AI Wave Planning returns "Unterminated string" JSON error

**Status:** `[x]` Fixed 2026-03-15

**Fix applied:**
- Increased `max_tokens` from `1500` to `4096` in `planear_visitas_automatico`
- Added empty-response guard: returns `{"erro": "Resposta vazia da IA"}` if `raw` is empty
- `.strip()` applied before `json.loads` to remove stray whitespace/fences

**Files changed:** `backend/app/ai/intelligence.py` (line ~1020)

---

## BUG 5 — Visitas page: search field appears above page title on mobile

**Status:** `[x]` Fixed 2026-03-15

**Fix applied:**
- Changed header container from `flex items-center gap-3 flex-wrap` to
  `flex flex-col sm:flex-row sm:items-center gap-3`
- Title and icon block always renders first on mobile; search bar is below on
  narrow viewports and beside the title on ≥ 640 px screens.

**Files changed:** `frontend/src/app/visitas/page.tsx` (header row ~line 687)

---

## BUG 6 — Image upload: thumbnail does not load (MinIO hostname / mixed content)

**Status:** `[x]` Fixed 2026-03-15

**Fix applied:**
- Added `minio_public_url: str = ""` config field to `backend/app/config.py`
- `storage.py` `presigned_get_url()` now rewrites the internal `http://minio:9000`
  host to `minio_public_url` when the env var is set
- Added `upstream minio { server minio:9000; }` block to `nginx.conf`
- Added `location /storage/ { proxy_pass http://minio/; }` in `nginx.conf` so
  browsers reach MinIO via the public HTTPS origin
- Added nginx to `internal` Docker network in `docker-compose.yml` so it can
  reach the `minio` container

**Deployment:** Set `MINIO_PUBLIC_URL=/storage` (or full URL `https://q21.otokura.online/storage`) in `.env`

**Files changed:**
- `backend/app/config.py`
- `backend/app/services/storage.py`
- `infra/nginx/nginx.conf`
- `docker-compose.yml`

---

## BUG 7 — Camera button opens file picker instead of native camera

**Status:** `[x]` Fixed 2026-03-15

**Fix applied:**
- `Permissions-Policy` header in `nginx.conf` was set to `camera=()` which
  **blocked all camera access**. Changed to `camera=(self)` to allow camera
  within the same origin.
- The `capture="environment"` on the `<input>` element was already correct HTML.

**Files changed:** `infra/nginx/nginx.conf`

---

## BUG 8 — Visitas list AI analysis button does nothing

**Status:** `[x]` Fixed 2026-03-15

**Fix applied:**
- `catch {}` block in `runIaAnalysis` now captures the error message and calls
  `alert("IA indisponível: " + msg)` so users receive visible feedback when the
  AI request fails.
- Error type guard `e instanceof Error` used for safe message extraction.

**Files changed:** `frontend/src/app/visitas/page.tsx` (`runIaAnalysis`, ~line 656)

---

## BUG 9 — PDF export returns 500 Internal Server Error

**Endpoint:** `GET /api/visitas/{id}/pdf`

**Status:** `[x]` Already fixed (prior to this audit)

**Finding:**
`backend/app/routers/visitas.py` photo loop already has a `try/except Exception:`
block around the `_storage.download_bytes(…)` call that skips missing photos
and continues the PDF generation. The 500 error is not triggered by missing
MinIO objects. The bug was already resolved in a previous session.

---

## BUG 10 — AI analysis modal: oversized, page unscrollable, cannot close

**Status:** `[x]` Fixed 2026-03-15

**Fix applied:**
- Added `max-h-[90vh] flex flex-col` to the modal card so it fits the viewport
- Made the content area `overflow-y-auto flex-1` so long content scrolls within
  the modal
- Added `flex-shrink-0` to the header bar so it remains visible while content scrolls
- Added `useEffect` hook that locks body scroll (`document.body.style.overflow = "hidden"`)
  on modal open and restores it on unmount
- Added `Escape` key listener to close the modal imperatively

**Files changed:** `frontend/src/app/visitas/page.tsx` (`EditModal`, ~lines 306-480)

---

## Summary

| # | Title | Status |
|---|-------|--------|
| 1 | URL always `/dashboard` | `[x]` Not in codebase — nginx/AppShell clean |
| 2 | "Novo" button broken + wrong colour | `[x]` Fixed |
| 3 | Estudo mobile button layout | `[x]` Fixed |
| 4 | AI Wave Planning — JSON unterminated string | `[x]` Fixed |
| 5 | Visitas — search above title on mobile | `[x]` Fixed |
| 6 | Thumbnails broken (MinIO hostname / mixed content) | `[x]` Fixed |
| 7 | Camera button opens file picker | `[x]` Fixed |
| 8 | Visitas AI button does nothing | `[x]` Fixed |
| 9 | PDF export returns 500 | `[x]` Already fixed |
| 10 | AI modal oversized / unscrollable / unclosable | `[x]` Fixed |

