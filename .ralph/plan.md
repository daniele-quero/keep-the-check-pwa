## PRD

### Objective
Eliminate the OCR.space integration from the Keep-The-Check PWA and replace the entire `capture → OCR → AI-text-parse → save` pipeline with a single `capture → AI vision API → structured JSON → user-confirms → save` flow. The image is sent directly to a configurable AI vision endpoint together with a verbatim extraction prompt; the modal lets the user review and edit the structured result before items are persisted to the list. Legacy data shapes and tutorial content must be migrated, and a Vitest suite must demonstrate the new flow end-to-end with mocks.

### Scope
- **In scope**
  - Remove every OCR.space code path (api function, config fields, UI controls, tutorial section, dev/prod proxies, tests, type enum).
  - Add `sendImageToAI(base64, prompt, opts?)` in [src/api.ts](src/api.ts).
  - Embed the mandatory extraction prompt verbatim in a new module.
  - Extend `AppConfig` (AI endpoint, model, timeout, proxy toggle, require-manual-confirmation flag, image-AI api key map) and migrate `localStorage["appConfig"]`.
  - Extend `PriceItem` with `currency`, `confidence`, `source` and migrate in-memory shape for legacy.
  - Rebuild add-modal flow: spinner ("Analisi IA in corso…"), editable structured results, manual fallback, confirm/save.
  - Options-modal: AI endpoint, model, timeout, proxy toggle, require-confirmation toggle, image-AI key field, inline warning about not committing keys; preserve YAML import/export round-trip.
  - Tutorial: rewrite the OCR section as "Analisi IA dell'immagine" (it + en), update privacy note and key-acquisition steps; update tooltips.
  - Vitest coverage: `sendImageToAI` (success, malformed JSON, HTTP error, timeout/abort), addModal flow (mock capture → analyze → edit → save), listManager migration of legacy entries, fixtures for multi-price and `1.234,56` vs `1,234.56` locales.
- **Out of scope**
  - Replacing/upgrading `CameraService`, `Modal`, `ListManager`, coupon logic, totals UI.
  - Changing the deployment target (Netlify stays; only the redirect rule is updated/removed).
  - Adding a new AI provider abstraction layer beyond a single configurable endpoint.
  - Server-side key storage; the key remains user-supplied in localStorage with a documented warning.

### Constraints
- TypeScript strict, Vite + vanilla DOM, Vitest 2 + jsdom (no new runtime deps).
- Prompt string must be embedded **verbatim** (no edits, no template substitution) per user spec.
- API key **never** committed (no `.env` with secrets, only `.env.example`; `.gitignore` covers `.env*` except `.env.example`).
- Network call must support `AbortController` timeout and behind-proxy mode (relative path) vs direct mode (absolute endpoint).
- Backwards-compatible load of existing `localStorage["appConfig"]` entries written by the OCR.space build.

### Deliverables
1. New module [src/aiPrompt.ts](src/aiPrompt.ts) exporting `IMAGE_EXTRACTION_PROMPT` (verbatim) and `AiExtractionResult` types matching the schema (version, products[], image_text, metadata, warnings, uncertain).
2. New function `sendImageToAI(base64, prompt, opts?)` in [src/api.ts](src/api.ts); `recognizeOcr` / `OcrOptions` deleted.
3. Updated `AppConfigData` in [src/config.ts](src/config.ts) with `aiImageEndpoint`, `aiImageModel`, `aiImageApiKeys`, `aiImageTimeoutMs`, `useImageProxy`, `requireManualConfirm`, `useImageAi`; OCR-related fields removed; one-shot migration on load.
4. Updated [src/modals/optionsModal.html](src/modals/optionsModal.html) + [src/modals/optionsModal.ts](src/modals/optionsModal.ts) with the new controls and security warning text.
5. Rewritten add-modal HTML + logic ([src/modals/addModal.html](src/modals/addModal.html), addModal controller extracted from [src/main.ts](src/main.ts) into a new `src/modals/addModalController.ts` or kept in main.ts—see plan) with spinner, editable rows, confirm/cancel, manual entry block.
6. Updated tutorial content + tooltips in [src/tutorial.ts](src/tutorial.ts) (it + en) and YAML mappings in [src/yamlConfig.ts](src/yamlConfig.ts).
7. Updated UI refs in [src/ui.ts](src/ui.ts) (OCR refs removed, AI image refs added; new helper to render editable structured rows).
8. Removed OCR proxy from [vite.config.ts](vite.config.ts) and [netlify.toml](netlify.toml); optional generic `/ai-proxy` rule added behind the proxy toggle.
9. Updated/expanded tests: rewritten [tests/api.test.ts](tests/api.test.ts), new [tests/aiPrompt.test.ts](tests/aiPrompt.test.ts), expanded [tests/addModal.test.ts](tests/addModal.test.ts), new [tests/listManager.test.ts](tests/listManager.test.ts) migration cases, updated [tests/config.test.ts](tests/config.test.ts) and [tests/yamlConfig.test.ts](tests/yamlConfig.test.ts), new fixtures under `tests/fixtures/ai/`.
10. `.env.example` documenting required keys (no real values), `.gitignore` update if needed, README section on configuration.

---

## Current Codebase Findings
Read concretely:

- [package.json](package.json): Vitest 2, jsdom 27, no runtime deps, `npm test` runs `vitest run`.
- [vite.config.ts](vite.config.ts): dev proxy `/ocr-proxy` → `https://api.ocr.space/parse/image`.
- [vitest.config.ts](vitest.config.ts): jsdom + globals.
- [tsconfig.json](tsconfig.json): strict, ES2020/ESNext.
- [src/api.ts](src/api.ts): exports `recognizeOcr(base64, apiKey, language="ita", options)` calling `OCR_ENDPOINT="/ocr-proxy"`, plus `parseWithGemini`, `parseWithGroq`, `cleanAndParse` returning `PriceResult`.
- [src/camera.ts](src/camera.ts): `CameraService.capture()` and `captureCropped(cropRatio)` return base64 JPEG (q=0.75) **without** the data-URL prefix.
- [src/config.ts](src/config.ts): `AppConfigData` includes `ocrProvider`, `ocrEngine`, `ocrIsTable`, `useOcr`, `ocrApiKeys`, `aiApiKeys`, `aiProvider`, `currency`, `useCoupons`, `couponValue`, `couponAlertThreshold`. `ConfigService` persists to `localStorage["appConfig"]`; exposes `getOcrApiKey()` / `getAiApiKey()` and observer pattern.
- [src/yamlConfig.ts](src/yamlConfig.ts): `parseSimpleYaml`, `applyYamlToModal`, `exportConfigYaml` — round-trips OCR fields (`ocrApiKeys`, `ocrEngine`, `ocrIsTable`, `useOcr`).
- [src/models.ts](src/models.ts): `enum OcrProvider { OcrSpace }`, `enum AiProvider { Gemini, Groq }`, `PriceItem { id, product, price, quantity }`, `PriceResult { items }`. No schema versioning.
- [src/listManager.ts](src/listManager.ts): in-memory `Map<number, PriceItem>` (no persistence of items). Coupon recalculation in `notify()`.
- [src/modal.ts](src/modal.ts): simple `Modal` class.
- [src/modals/addModal.ts](src/modals/addModal.ts) + [addModal.html](src/modals/addModal.html): HTML injection only; fields are `add-product`, `add-price`, `add-qty-display`, buttons `add-ok` / `add-cancel`. Logic lives in [src/main.ts](src/main.ts) (`doScan`, `openEditModal`, OK handler around lines 195–330).
- [src/modals/optionsModal.html](src/modals/optionsModal.html): contains `opt-ocr-engine`, `opt-ocr-key`, `opt-use-ocr` (disabled checked), `opt-ocr-table`; AI provider/key fields exist for Gemini/Groq.
- [src/modals/tutorialModal.ts/.html](src/modals/tutorialModal.html): renders content from [src/tutorial.ts](src/tutorial.ts) by `tutorialLang` localStorage key.
- [src/tutorial.ts](src/tutorial.ts): IT + EN sections include "🔑 API key di OCR Space" (ocr.space/ocrapi) and tooltips `"OCR Engine"`, `"isTable"`, `"Use OCR"`, `"OCR Key"`.
- [src/ui.ts](src/ui.ts): getters `inputOcrKey`, `selOcrEngine`, `chkOcrTable`, `chkUseOcr`, `spinner`; helper `addResultItem(item, isError?, onEdit?)`.
- [src/main.ts](src/main.ts): `doScan()` calls `recognizeOcr` → `callAiWithFallback` → builds items via `addResultItem`. Spinner shown via `uiRefs.spinner.classList.add("active")`. Options OK handler saves OCR fields. `openEditModal` reuses add-modal panel to edit existing items.
- [index.html](index.html): no hardcoded keys; `#spinner` is a sibling of `#camera-section`.
- [netlify.toml](netlify.toml): production redirect `/ocr-proxy` → OCR.space.
- Tests: [tests/api.test.ts](tests/api.test.ts) stubs `fetch` and asserts URL `/ocr-proxy`, OCR.space response shape, and AI parse paths; [tests/config.test.ts](tests/config.test.ts) round-trips all config fields including OCR ones; [tests/addModal.test.ts](tests/addModal.test.ts) only checks HTML injection (no flow tests); [tests/listManager.test.ts](tests/listManager.test.ts) covers coupon math; [tests/yamlConfig.test.ts](tests/yamlConfig.test.ts) tests nested map parsing; [tests/tutorial.test.ts](tests/tutorial.test.ts) checks render + tooltip presence.
- No `.env` / `.env.example` exists today.
- `localStorage` keys in use: `"appConfig"`, `"tutorialLang"`.

---

## Implementation Plan

> Each step is small, independently testable, and the executor must keep `npm test` green between steps. Tests inside each step are additive unless the step says "rewrite".

### Step 1 — Introduce the AI extraction prompt and result types
- **Goal**: Make the verbatim prompt and JSON schema available to the rest of the code with zero behavioral change yet.
- **Files**: create [src/aiPrompt.ts](src/aiPrompt.ts); create `tests/aiPrompt.test.ts`; create `tests/fixtures/ai/single-price-it.json`, `tests/fixtures/ai/multi-price-en.json`, `tests/fixtures/ai/locale-it-1234-56.json`, `tests/fixtures/ai/locale-en-1234-56.json`, `tests/fixtures/ai/uncertain.json`.
- **Changes**:
  - Export `IMAGE_EXTRACTION_PROMPT` containing **verbatim** the block defined in the user task (no trimming, no template insertion).
  - Export TypeScript interfaces `AiExtractedProduct`, `AiExtractedPrice`, `AiBoundingBox`, `AiExtractionMetadata`, `AiExtractionResult` matching the schema (`version`, `products[]`, `image_text`, `metadata`, `warnings`, `uncertain`).
  - Export `parseAiExtractionJson(raw: string | object): AiExtractionResult` — strips Markdown fences, parses, validates required keys, throws `AiExtractionError` with a stable `code` (`"invalid_json"`, `"schema_mismatch"`).
  - Export `toPriceItems(result, defaultCurrency): Array<{ product: string; price: number; currency: string; confidence: number; source: "ai" }>` (id assigned later by caller). Picks best name candidate (highest `confidence`), iterates each price (or selects `total_price`/`unit_price` preferentially — define rule: pick all `unit_price` and `total_price` entries, skip `old_price` unless it is the only one; document in 1-line comment because the rule is non-obvious).
- **Tests**:
  - `IMAGE_EXTRACTION_PROMPT` is exactly the expected string (snapshot or `toBe` against the canonical literal).
  - `parseAiExtractionJson` accepts each fixture and returns the expected shape.
  - `parseAiExtractionJson` strips ```` ```json ```` fences.
  - Throws `AiExtractionError("invalid_json")` on garbage; throws `"schema_mismatch"` on missing `products`.
  - `toPriceItems` handles multi-price fixture (returns N items), locale fixtures (normalized float equals 1234.56), and selects best name candidate.
- **Done-when**: New module + fixtures compile and all new tests pass; existing tests unaffected.

### Step 2 — Add `sendImageToAI` to api.ts (alongside, do not delete OCR yet)
- **Goal**: New transport in isolation, fully unit-tested.
- **Files**: [src/api.ts](src/api.ts); update [tests/api.test.ts](tests/api.test.ts) (add new describe block; keep OCR block for now).
- **Changes**:
  - Add `interface SendImageToAiOptions { endpoint: string; apiKey: string; model?: string; timeoutMs?: number; signal?: AbortSignal; useProxy?: boolean; }` and `function sendImageToAI(base64: string, prompt: string, opts: SendImageToAiOptions): Promise<AiExtractionResult>`.
  - Request: POST JSON `{ model, prompt, image: { mimeType: "image/jpeg", dataBase64: base64 } }` to `opts.useProxy ? "/ai-proxy" : opts.endpoint`. Authorization header `Bearer <apiKey>` (skipped when `useProxy` true).
  - Timeout via `AbortController` (default 30000 ms, overridable). Maps abort to `AiExtractionError("timeout")`; non-2xx to `AiExtractionError("http_<status>")`; calls `parseAiExtractionJson` on the body (supports either `{ output_text }` envelope or raw JSON — try direct then fall back to common envelope keys `output_text` / `choices[0].message.content`).
  - Export `AiExtractionError` class with `code: string`.
- **Tests** (new block in api.test.ts):
  - Success: mocked fetch returns JSON body matching multi-price fixture; assertion: returned object matches fixture, fetch called with correct URL, Authorization header, JSON body containing the prompt verbatim and base64.
  - Envelope: fetch returns `{ output_text: "<fixture JSON as string>" }`; result correctly parsed.
  - Proxy mode: `useProxy: true` → URL is `/ai-proxy`, no Authorization header.
  - Timeout: fetch never resolves; advance fake timers; assert `AiExtractionError` with `code === "timeout"` and `AbortController` was aborted.
  - HTTP error: 500 → `AiExtractionError` `code: "http_500"`.
  - Bad JSON: 200 with garbage → `code: "invalid_json"`.
- **Done-when**: New tests pass; OCR tests still pass; no production usage of `sendImageToAI` yet.

### Step 3 — Extend config with new AI-image fields + migration (keep OCR fields readable)
- **Goal**: Make new config available, migrate legacy `localStorage["appConfig"]`, preserve back-compat for one release.
- **Files**: [src/config.ts](src/config.ts), [src/models.ts](src/models.ts), [tests/config.test.ts](tests/config.test.ts).
- **Changes**:
  - Add to `AppConfigData`: `aiImageEndpoint: string` (default `""`), `aiImageModel: string` (default `""`), `aiImageTimeoutMs: number` (default `30000`), `useImageProxy: boolean` (default `false`), `requireManualConfirm: boolean` (default `true`), `useImageAi: boolean` (default `true`), `aiImageApiKeys: Record<string, string>` (default `{ default: "" }`), `schemaVersion: 2` (new).
  - `ConfigService.load()`: read JSON, if `schemaVersion !== 2` run `migrateLegacyConfig(raw)` which copies `aiApiKeys`/`currency`/coupons through unchanged, drops `ocrProvider`/`ocrEngine`/`ocrIsTable`/`useOcr`/`ocrApiKeys`, sets defaults for new fields, stamps `schemaVersion: 2`, and persists once.
  - Add `getAiImageApiKey(): string` returning `aiImageApiKeys["default"] ?? ""`. **Do not yet delete** the OCR getters — they will be removed in Step 8 to keep diff size small per step (but mark them by adding a single-line note comment is forbidden; just leave them and remove later — no comment).
- **Tests** (extend tests/config.test.ts):
  - Loading a legacy blob (with `ocrApiKeys`, no `schemaVersion`) produces a migrated config with new defaults, OCR fields gone, `schemaVersion: 2` persisted (assert via storage.getItem).
  - Saving partial new fields round-trips through localStorage.
  - `requireManualConfirm` default is `true`; `useImageAi` default is `true`.
  - Custom endpoint/model/timeout/proxy values round-trip.
- **Done-when**: All tests pass; legacy localStorage payloads still load without throwing.

### Step 4 — Extend `PriceItem` with `currency`, `confidence`, `source`; migrate listManager
- **Goal**: Make new fields available to the UI and assert legacy items still work.
- **Files**: [src/models.ts](src/models.ts), [src/listManager.ts](src/listManager.ts), [tests/listManager.test.ts](tests/listManager.test.ts).
- **Changes**:
  - Extend `PriceItem` with optional `currency?: string`, `confidence?: number`, `source?: "ai" | "manual" | "legacy"`.
  - In `ListManager.addItem`: if `source` missing, set `"legacy"`; if `currency` missing, fall back to `config.current.currency`.
  - `updateItem` signature stays compatible (no new required args).
- **Tests**:
  - Adding an item without `currency/source` results in `source === "legacy"` and `currency === config.current.currency`.
  - Adding an AI-sourced item preserves `currency`, `confidence`, `source: "ai"`.
  - Coupon tests still pass.
- **Done-when**: Tests pass; existing main.ts call sites compile (optional fields).

### Step 5 — Add new options-modal UI controls
- **Goal**: User can configure AI endpoint/model/timeout/proxy/manual-confirm/key without touching scan flow yet.
- **Files**: [src/modals/optionsModal.html](src/modals/optionsModal.html), [src/ui.ts](src/ui.ts), [src/main.ts](src/main.ts) options OK handler, [src/yamlConfig.ts](src/yamlConfig.ts), [tests/yamlConfig.test.ts](tests/yamlConfig.test.ts).
- **Changes**:
  - HTML: add `#opt-ai-image-endpoint` (text), `#opt-ai-image-model` (text), `#opt-ai-image-timeout` (number, ms), `#opt-ai-image-key` (password, `autocomplete="off"`), `#opt-use-image-proxy` (checkbox), `#opt-require-confirm` (checkbox), `#opt-use-image-ai` (checkbox). Add a static `<p class="opt-warning">` warning: "⚠️ Non condividere né committare la API key. È salvata solo nel tuo browser."
  - `ui.ts`: add getters `inputAiImageEndpoint`, `inputAiImageModel`, `inputAiImageTimeout`, `inputAiImageKey`, `chkUseImageProxy`, `chkRequireConfirm`, `chkUseImageAi`.
  - `main.ts` options OK handler: in addition to existing fields, persist the new ones; on options open, populate from `config.current`.
  - `yamlConfig.ts`: include new fields in `exportConfigYaml` and `applyYamlToModal` (mapping `aiImageApiKeys` as nested map). **Remove** OCR field handling from YAML in this same step (they will be removed entirely in Step 8; YAML import of unknown keys must silently ignore them to keep round-trips of older exports working — already the case for `parseSimpleYaml`).
- **Tests**:
  - yaml round-trip for `aiImageEndpoint`, `aiImageModel`, `aiImageTimeoutMs`, `useImageProxy`, `requireManualConfirm`, `useImageAi`, `aiImageApiKeys`.
  - yaml import of a legacy YAML containing `ocrApiKeys`/`ocrEngine` does not crash and does not set those keys on the new config.
- **Done-when**: Tests pass; options modal still opens (manual smoke not required; DOM-level test in step 6 covers presence).

### Step 6 — Rewrite scan flow to use `sendImageToAI` with editable add-modal
- **Goal**: The new pipeline becomes the only scan path; the add-modal becomes the analysis-and-confirm surface.
- **Files**: [src/modals/addModal.html](src/modals/addModal.html), new [src/modals/addModalController.ts](src/modals/addModalController.ts) (exports `openAddModalForScan(base64)`, `openAddModalForManual()`, `openAddModalForEdit(item)`), [src/main.ts](src/main.ts), [src/ui.ts](src/ui.ts), [src/aiPrompt.ts](src/aiPrompt.ts) (no change), [src/api.ts](src/api.ts) (no change).
- **Changes**:
  - HTML add-modal becomes three vertical regions controlled by classes `mode-analyze`, `mode-results`, `mode-manual`:
    - Analyze region: `<div id="add-spinner">Analisi IA in corso…</div>`, cancel button `#add-analyze-cancel`.
    - Results region: container `#add-ai-results` (list of editable rows: product input, price input, currency input, confidence read-only badge, delete row button `.add-row-del`), button `#add-row-new` ("Aggiungi riga"), and the existing OK/cancel buttons (relabeled "Conferma"/"Annulla").
    - Manual region: existing single-product form (product/price/qty) reused as the manual-entry fallback; toggle button `#add-switch-manual` is shown in both analyze (after a failure) and results regions.
  - `addModalController.ts` orchestrates: opens modal in `mode-analyze`, calls `sendImageToAI(base64, IMAGE_EXTRACTION_PROMPT, { endpoint, apiKey, model, timeoutMs, useProxy })` using `AbortController` wired to `#add-analyze-cancel`, on success calls `toPriceItems(result, config.current.currency)` and renders editable rows in `mode-results`, on error renders an error banner in `mode-analyze` plus a "Inserisci manualmente" button switching to `mode-manual`. If `config.current.requireManualConfirm === false`, auto-add all items to `listManager` and close (still passing through the rows for one render-tick to keep the audit predictable — actually simpler: skip render and add directly).
  - "Conferma" reads each row, constructs `PriceItem` with `source: "ai"` (or `"manual"` for rows added via `#add-row-new` and for the manual-mode form), `currency`, `confidence`, calls `listManager.addItem` for each, then closes.
  - `main.ts` `doScan()` simplifies to: capture base64 → call `openAddModalForScan(base64)`. Spinner overlay on `#camera-section` is no longer used; the in-modal spinner replaces it. `btn-add` calls `openAddModalForManual()`. `openEditModal(item)` calls `openAddModalForEdit(item)` which uses `mode-manual` prefilled.
  - Remove `callAiWithFallback` from main.ts (it depended on OCR text input).
- **Tests** (rewrite [tests/addModal.test.ts](tests/addModal.test.ts)):
  - HTML injection still idempotent and contains new elements (`#add-spinner`, `#add-ai-results`, `#add-row-new`, `#add-analyze-cancel`, `.opt-warning` not here but `#add-switch-manual`).
  - Flow test with `vi.mock("../src/api", ...)`: `openAddModalForScan("base64")` → spinner visible → resolves with the multi-price fixture → results region rendered with N editable rows → user edits one price → click `#add-ok` → `listManager` contains N items with `source: "ai"` and correct currencies.
  - Error path: `sendImageToAI` rejects with `AiExtractionError("timeout")` → analyze region shows error message containing "timeout" (Italian-friendly) and "Inserisci manualmente" button is present → clicking it switches to `mode-manual`.
  - Manual fallback: filling product/price/qty and clicking `#add-ok` in `mode-manual` adds a single `source: "manual"` item.
  - `requireManualConfirm: false`: stubbed config + successful scan → no results region shown, items added directly, modal closes.
- **Done-when**: New tests pass; manual smoke not required; old OCR-driven tests in api.test.ts still pass because Step 8 has not yet removed `recognizeOcr`.

### Step 7 — Update tutorial content and tooltips
- **Goal**: Documentation matches the new flow.
- **Files**: [src/tutorial.ts](src/tutorial.ts), [tests/tutorial.test.ts](tests/tutorial.test.ts).
- **Changes**:
  - Replace the "🔑 API key di OCR Space" / "🔑 OCR Space API Key" sections with "🔑 API key per l'Analisi IA dell'immagine" / "🔑 Image AI Analysis API Key": steps to obtain a key from the chosen provider (placeholder text — generic "consulta la documentazione del tuo provider"), reminder that the key is stored only in the browser and must not be committed.
  - Replace the "Scanning" section copy: capture → invio diretto all'API IA → risultati strutturati modificabili → conferma; mention privacy (image leaves the device only when scan is triggered; goes only to the configured endpoint).
  - Remove tooltips `"OCR Engine"`, `"isTable"`, `"Use OCR"`, `"OCR Key"`; add tooltips `"AI Image Endpoint"`, `"AI Image Model"`, `"AI Image Timeout"`, `"AI Image Key"`, `"Use Image Proxy"`, `"Require Manual Confirm"`, `"Use Image AI"`.
- **Tests**:
  - `renderTutorial("it")` and `("en")` contain "Analisi IA" / "Image AI" and do **not** contain "OCR Space".
  - `getOptionTooltips("it")["AI Image Endpoint"]` defined; `["OCR Engine"]` undefined.
- **Done-when**: Tests pass.

### Step 8 — Delete all OCR.space code, configs, tests, and proxies
- **Goal**: No reference to OCR.space remains in `src/` or `tests/`.
- **Files**: [src/api.ts](src/api.ts), [src/config.ts](src/config.ts), [src/models.ts](src/models.ts), [src/ui.ts](src/ui.ts), [src/modals/optionsModal.html](src/modals/optionsModal.html), [src/main.ts](src/main.ts), [src/yamlConfig.ts](src/yamlConfig.ts), [vite.config.ts](vite.config.ts), [netlify.toml](netlify.toml), [tests/api.test.ts](tests/api.test.ts), [tests/config.test.ts](tests/config.test.ts).
- **Changes**:
  - Delete `OCR_ENDPOINT`, `OcrOptions`, `recognizeOcr` from api.ts.
  - Delete `parseWithGemini`, `parseWithGroq`, `cleanAndParse`, `AiProvider` enum usage in api.ts if the new flow no longer needs them — verify Step 6 removed all call sites; if so, also drop `aiProvider` and `aiApiKeys` from config and remove the provider dropdown / Gemini+Groq key fields in optionsModal.html (re-check user spec: the new flow is image-only, so Gemini/Groq text-parsing path is dead code by definition). Keep this deletion atomic: also drop from yaml and tutorial tooltip lists.
  - Delete `OcrProvider` from models.ts; delete `ocrProvider`/`ocrEngine`/`ocrIsTable`/`useOcr`/`ocrApiKeys` from `AppConfigData` and `DEFAULTS`; delete `getOcrApiKey`.
  - Delete `inputOcrKey`/`selOcrEngine`/`chkOcrTable`/`chkUseOcr` getters and the corresponding `<select>`/`<input>`/`<checkbox>` elements in optionsModal.html.
  - Delete OCR option-save lines in main.ts options handler.
  - Delete `/ocr-proxy` dev proxy in vite.config.ts; add `/ai-proxy` rewrite to `https://example.invalid/v1/chat/completions` **only as a commented-out template** — wait, comments are discouraged; instead: delete the OCR proxy and add a generic `/ai-proxy` rule pointing to `process.env.AI_PROXY_TARGET ?? "https://api.openai.com/v1/responses"` so it stays functional without committing a real endpoint. Document in README.
  - Delete `/ocr-proxy` redirect in netlify.toml; add `/ai-proxy` redirect to an env-substituted value or leave commented-out section — since netlify.toml does not support env easily, leave the new redirect commented in netlify.toml; the file is infra config, not source, so a comment is acceptable there.
  - Rewrite api.test.ts: remove the `recognizeOcr` describe and any Gemini/Groq parse tests; keep / expand the `sendImageToAI` block from Step 2.
  - Trim config.test.ts: remove tests referencing OCR fields; keep migration test (Step 3) covering the legacy → new transition.
- **Tests**:
  - Add a meta-test in tests/api.test.ts: `expect(api).not.toHaveProperty("recognizeOcr")`.
  - `npm test` clean.
- **Done-when**: `grep -ri "ocr" src/ tests/` returns zero hits (excluding any historical comment-free code) and `npm test` is green. Verifier will run this grep.

### Step 9 — Documentation, env example, README
- **Goal**: Operational guidance for keys, proxy, and privacy.
- **Files**: create `.env.example`; update `.gitignore` if needed; update [README.md](README.md).
- **Changes**:
  - `.env.example`: keys `AI_PROXY_TARGET=` (used by vite dev proxy), `# AI_IMAGE_API_KEY=  # store only in the browser via Options modal — never commit`.
  - `.gitignore`: ensure `.env`, `.env.*`, `!.env.example` are present (add if missing).
  - README: section "Configurazione AI" with steps to obtain a key, paste it into Options, choose proxy vs direct mode, and the privacy note.
- **Tests**: none (docs-only).
- **Done-when**: Files committed; `git status` shows no committed real keys.

---

## Acceptance Criteria
1. `grep -ri "ocr" c:\Users\dquero\projects\keep-the-check-pwa\src` and `... \tests` return **zero** matches (case-insensitive).
2. [src/api.ts](src/api.ts) exports `sendImageToAI(base64, prompt, opts)` and `AiExtractionError`; does **not** export `recognizeOcr`, `OcrOptions`, `parseWithGemini`, `parseWithGroq`.
3. [src/aiPrompt.ts](src/aiPrompt.ts) exports `IMAGE_EXTRACTION_PROMPT` matching the user-supplied string **character-for-character** (verified by a `toBe` assertion against an inline literal in the test).
4. `sendImageToAI` (under mocked fetch): sends `IMAGE_EXTRACTION_PROMPT` verbatim in the request body along with the base64 image; parses both raw-JSON and envelope responses; handles HTTP errors and `AbortController` timeouts with typed `AiExtractionError` codes.
5. Add-modal flow under mocks: spinner ("Analisi IA in corso…") shown during analysis; on success the user can edit/add/delete rows and clicking Conferma adds each row to `listManager` with `source: "ai"`; on error a manual-fallback button switches to a manual-entry form that adds a `source: "manual"` item; honors `requireManualConfirm: false` by skipping the editable step.
6. Options modal exposes endpoint, model, timeout, proxy toggle, require-manual-confirm toggle, image-AI key field, and a visible warning that the key must not be committed; round-trips through YAML import/export and through `localStorage["appConfig"]`.
7. `ConfigService` migrates legacy `localStorage["appConfig"]` (no `schemaVersion`, with OCR fields) to `schemaVersion: 2` without throwing, dropping OCR fields and applying new defaults; the migrated config is persisted exactly once.
8. `PriceItem` supports optional `currency`, `confidence`, `source`; `ListManager` defaults legacy items to `source: "legacy"` with current config currency and continues to satisfy all existing coupon tests.
9. Tutorial (it + en) and option tooltips contain the new AI-image content and contain zero references to OCR/OCR Space; tooltip keys `"AI Image Endpoint"`, `"AI Image Model"`, `"AI Image Timeout"`, `"AI Image Key"`, `"Use Image Proxy"`, `"Require Manual Confirm"`, `"Use Image AI"` are present.
10. No API keys are committed; `.env.example` is present and contains only placeholders; `.gitignore` excludes real `.env` files.
11. `npm test` passes with at least: prompt-snapshot test, `sendImageToAI` success / envelope / proxy / timeout / HTTP-error / invalid-JSON tests, `parseAiExtractionJson` + `toPriceItems` fixture tests (multi-price + `1.234,56` + `1,234.56`), addModal scan-success / scan-error / manual-fallback / auto-confirm tests, listManager legacy-migration test, config legacy-migration test, yaml round-trip test for new fields, tutorial content tests.

---

## Stop Conditions
- Max iterations per step: **5**
- Max global iterations: **15**
- Stop when: every item in **Acceptance Criteria** is verified by the verifier (greps + `npm test` green) on a clean working tree.
