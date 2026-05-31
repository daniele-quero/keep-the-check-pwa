# Keep The Check — PWA

A Progressive Web App that helps you track prices while shopping. Point the camera at a price tag or receipt: the app sends the image directly to a configurable AI vision endpoint, which returns a structured list of products and prices. You review and edit the result, then save items to a running total.

---

## Table of Contents

1. [Tech Stack](#tech-stack)
2. [Project Structure](#project-structure)
3. [Getting Started](#getting-started)
4. [AI Image Analysis Configuration](#ai-image-analysis-configuration)
5. [Migration from the legacy OCR build](#migration-from-the-legacy-ocr-build)
6. [Privacy](#privacy)
7. [Source Files](#source-files)
   - [models.ts](#modelsts)
   - [config.ts](#configts)
   - [camera.ts](#camerats)
   - [aiPrompt.ts](#aipromptts)
   - [api.ts](#apits)
   - [listManager.ts](#listmanagerts)
   - [ui.ts](#uits)
   - [modal.ts](#modalts)
   - [tutorial.ts](#tutorialts)
   - [yamlConfig.ts](#yamlconfigts)
   - [main.ts](#maints)
   - [modals/optionsModal.ts](#modalsoptionsmodalts)
   - [modals/addModal.ts](#modalsaddmodalts)
   - [modals/addModalController.ts](#modalsaddmodalcontrollerts)
   - [modals/tutorialModal.ts](#modalstutorialmodalts)
8. [Public Assets](#public-assets)
9. [Test Suite](#test-suite)
10. [Data Flow](#data-flow)

---

## Tech Stack

| Tool | Role |
|---|---|
| **TypeScript 5** | Language |
| **Vite 5** | Dev server & bundler |
| **Vitest 2** | Unit test runner |
| **jsdom** | DOM emulation in tests |
| **AI Vision API** | Direct image-to-structured-JSON extraction (endpoint is user-configurable) |

---

## Project Structure

```
keep-the-check-pwa/
├── index.html             # App shell — static HTML skeleton
├── vite.config.ts         # Vite build configuration (includes /ai-proxy dev rewrite)
├── vitest.config.ts       # Vitest test configuration
├── tsconfig.json          # TypeScript compiler options
├── package.json           # NPM scripts and dependencies
├── netlify.toml           # Production redirects
├── generateIcons.mjs      # Script to generate PWA icons with sharp
├── .env.example           # Template env vars for a server-side AI proxy
├── public/
│   ├── manifest.json      # PWA manifest
│   └── sw.js              # Service Worker (network-first pass-through)
└── src/
    ├── main.ts            # App entry point — wires everything together
    ├── models.ts          # Shared data types and factory functions
    ├── config.ts          # Persistent configuration service (schemaVersion: 3)
    ├── camera.ts          # Camera access and image capture
    ├── aiPrompt.ts        # Verbatim extraction prompt + JSON-schema parsing
    ├── api.ts             # sendImageToAI transport
    ├── listManager.ts     # Shopping list state and total logic
    ├── ui.ts              # DOM references and result item rendering
    ├── modal.ts           # Generic modal base class
    ├── tutorial.ts        # Tutorial content (IT/EN) and rendering
    ├── yamlConfig.ts      # YAML config import/export
    ├── style.css          # Global styles
    └── modals/
        ├── addModal.html              # Add/scan modal markup
        ├── addModal.ts                # Add modal factory
        ├── addModalController.ts      # Scan/edit/manual flow orchestrator
        ├── optionsModal.html          # Options modal markup
        ├── optionsModal.ts            # Options modal factory + tooltips
        ├── tutorialModal.html         # Tutorial modal markup
        └── tutorialModal.ts           # Tutorial modal factory + language switch
```

---

## Getting Started

```bash
npm install          # Install dependencies
npm run dev          # Start dev server (http://localhost:5173)
npm run build        # TypeScript check + Vite production build → dist/
npm run preview      # Serve the dist/ folder locally
npm test             # Run all tests once
npm run test:watch   # Run tests in watch mode
```

---

## AI Image Analysis Configuration

The scan pipeline sends the captured JPEG (base64) plus the verbatim extraction prompt from `src/aiPrompt.ts` to one or more configurable AI providers, and expects a JSON response matching the schema declared in that file (`version`, `products[]`, `image_text`, `metadata`, `warnings`, `uncertain`).

Configure the flow from the **Options** modal (or by importing a YAML file with the same keys). The following fields exist on `AppConfigData` in [src/config.ts](src/config.ts):

| Field | Type | Description |
|---|---|---|
| `aiEndpoint` | `string` | Absolute URL of the AI vision endpoint. Ignored when `aiUseProxy` is `true`. |
| `aiModel` | `string` | Model identifier sent in the request body (e.g. `gpt-4o-mini`). |
| `aiApiKey` | `string` | Bearer token sent in the `Authorization` header. **Only used in direct mode** (`aiUseProxy: false`). Leave empty when using a proxy. |
| `aiTimeoutMs` | `number` | Request timeout enforced via `AbortController`. Default `30000`. |
| `aiUseProxy` | `boolean` | When `true`, requests are sent to the relative path `/ai-proxy` and no `Authorization` header is attached — your server-side proxy is expected to inject the real key. Default `true`. |
| `aiProviders` | `ProviderConfig[]` | Multi-provider list used for round-robin fallback. Each provider has `id`, `endpointTemplate`, `model`, `apiKey`, `useProxy`, `enabled`, `priority`, `timeoutMs`, `failureThreshold`, `cooldownMs`. |
| `requireManualConfirm` | `boolean` | When `true`, the editable results modal is shown before items are added to the list; when `false`, items are added immediately. Default `true`. |

### Built-in provider presets

The default config includes these providers (disabled by default until keys/endpoints are ready):

| Provider | Endpoint URL | Auth header in direct mode |
|---|---|---|
| Hugging Face | `https://router.huggingface.co/v1/chat/completions` | `Authorization: Bearer <key>` |
| Cloudflare Workers AI | `https://api.cloudflare.com/client/v4/accounts/{ACCOUNT_ID}/ai/v1/chat/completions` | `Authorization: Bearer <token>` |
| Fireworks | `https://api.fireworks.ai/inference/v1/chat/completions` | `Authorization: Bearer <key>` |
| Mistral | `https://api.mistral.ai/v1/chat/completions` | `Authorization: Bearer <key>` |
| Replicate | `https://api.replicate.com/v1/predictions` | `Authorization: Token <token>` |

### Fallback policy

- Enabled providers are sorted by `priority` and tried in round-robin order.
- Only providers with a non-empty `apiKey` are eligible for fallback attempts.
- On transient failures (`timeout`, network errors, `429`, `5xx`, parse failures) the next provider is attempted automatically.
- Soft circuit-breaker: each provider tracks consecutive failures; when `failureThreshold` is reached, it is skipped for `cooldownMs`.
- The public `sendImageToAI(imageBase64, prompt, opts)` API remains unchanged.

### Recommended: server-side proxy

Keep `aiUseProxy: true` and host a small proxy (Netlify Function, Cloudflare Worker, Vite dev rewrite, etc.) that forwards `/ai-proxy` to your provider with the real API key injected from a secret. This way the key never leaves your server.

[.env.example](.env.example) at the repo root lists the placeholder variables a proxy might consume (`AI_API_ENDPOINT`, `AI_API_KEY`, `AI_MODEL`). The example file contains placeholders only — never commit real keys.

### Direct mode (development only)

If you set `aiUseProxy: false`, the browser posts directly to `aiEndpoint` with `Authorization: Bearer <aiApiKey>`. The key is then stored in `localStorage` on the user's device. The Options modal shows a visible warning against using this mode in shared/committed configurations.

### Where to set values

- **Options modal** (preferred): each field has its own input. Changes are persisted to `localStorage["appConfig"]`.
- **YAML import/export**: the Options modal exposes Import (📁) and Export (💾) buttons. The exported YAML round-trips every field listed above; see [src/yamlConfig.ts](src/yamlConfig.ts).

---

## Migration from the legacy OCR build

Earlier releases used a two-step legacy OCR + text-parse pipeline. On the first load after upgrading, `ConfigService` auto-migrates any existing `localStorage["appConfig"]` payload:

- `schemaVersion` is bumped to `4`.
- Legacy keys are stripped: `ocrProvider`, `ocrEngine`, `ocrIsTable`, `useOcr`, `ocrApiKeys`, `aiProvider`, `aiApiKeys`.
- Preserved fields (`currency`, `useCoupons`, `couponValue`, `couponAlertThreshold`) are kept as-is.
- Defaults for the new `ai*` fields, `aiProviders`, and `requireManualConfirm` are applied.
- The migrated payload is written back to storage exactly once.

The user must then open Options to set `aiEndpoint` / `aiModel` and either enable the proxy or paste their key — there is no automatic key transfer.

---

## Privacy

- The captured image is **only** transmitted when the user explicitly triggers a scan.
- It is sent **only** to the configured `aiEndpoint` (or to your `/ai-proxy` when `aiUseProxy: true`).
- Nothing is uploaded in the background; there is no analytics or telemetry pipeline in this codebase.
- API keys configured in direct mode are stored in `localStorage` on the user's device only.

---

## Source Files

### `models.ts`

Shared data types, enums, and factory functions. Has zero dependencies on other source files.

#### Enums

| Enum | Values | Purpose |
|---|---|---|
| `CurrencyCode` | `EUR`, `USD`, `GBP`, … (20 total) | ISO 4217 currency codes |

#### Interfaces

| Interface | Fields | Purpose |
|---|---|---|
| `PriceItem` | `id: number`, `product: string`, `price: number`, `quantity: number`, optional `currency: string`, `confidence: number`, `source: "ai" \| "manual" \| "legacy"` | A single item in the shopping list |
| `PriceResult` | `items: PriceItem[]` | A batch of parsed items |

#### Functions

- `generateId(): number` — monotonically increasing session-unique IDs.
- `createPriceItem(product, price, opts?): PriceItem` — factory with `quantity: 1` and a fresh ID.

---

### `config.ts`

Persistent configuration in `localStorage["appConfig"]`. See [AI Image Analysis Configuration](#ai-image-analysis-configuration) for the full field reference.

- `DEFAULTS: AppConfigData` — initial values.
- `STORAGE_KEY = "appConfig"`.
- `CURRENT_SCHEMA_VERSION = 4`.
- `ConfigService` — reactive service:
       - `constructor(storage?)` — loads from storage and runs legacy-migration when `schemaVersion < 4` or any legacy key is present.
  - `get current(): Readonly<AppConfigData>`.
  - `save(partial)` — merges, persists, fires listeners.
  - `onChanged(fn)` / `removeListener(fn)`.
  - `getCurrencySymbol(): string`.
- Singleton: `export const config = new ConfigService()`.

---

### `camera.ts`

Wraps `MediaDevices` to access the rear camera and capture frames.

- `start()` / `stop()` / `get isActive()`.
- `capture(): string | null` — full-frame JPEG base64 (quality 0.75, no data-URL prefix).
- `captureCropped(cropRatio): string | null` — visible-rectangle aware capture that accounts for `object-fit: cover` and applies the user's crop slider.

---

### `aiPrompt.ts`

The verbatim extraction prompt and helpers that turn the AI response into `PriceItem` candidates.

- `IMAGE_EXTRACTION_PROMPT: string` — embedded verbatim; the integration test asserts character-for-character equality.
- Schema types: `AiExtractedProduct`, `AiExtractedPrice`, `AiBoundingBox`, `AiExtractionMetadata`, `AiExtractionResult`.
- `parseAiExtractionJson(raw: string | object): AiExtractionResult` — strips Markdown fences, parses, validates required keys. Throws `AiExtractionError("invalid_json")` or `AiExtractionError("schema_mismatch")`.
- `toPriceItems(result, defaultCurrency)` — picks the highest-confidence name and emits one item per `unit_price` / `total_price` entry, skipping `old_price` unless it is the only available price.
- `AiExtractionError` — typed error with a stable `code` string.

---

### `api.ts`

Single network function for the scan pipeline. No DOM access.

#### `sendImageToAI(base64, prompt, opts): Promise<AiExtractionResult>`

| Option | Description |
|---|---|
| `endpoint` | Absolute AI endpoint URL (used only in direct mode). |
| `apiKey` | Bearer token (used only in direct mode). |
| `model` | Optional model identifier. |
| `timeoutMs` | Default 30000 ms; enforced via `AbortController`. |
| `signal` | Optional caller-owned `AbortSignal` (composed with the timeout). |
| `useProxy` | When `true`, posts to `/ai-proxy` without an `Authorization` header. |

Request body: JSON `{ model, prompt, image: { mimeType: "image/jpeg", dataBase64: base64 } }`.

Response handling: tries the JSON body directly; if it doesn't match the schema, falls back to common envelope shapes (`output_text`, `choices[0].message.content`) and re-parses.

Errors are surfaced as `AiExtractionError` with codes: `"timeout"`, `"http_<status>"`, `"invalid_json"`, `"schema_mismatch"`.

---

### `listManager.ts`

Stateful shopping list. Tracks items, computes the total, and evaluates the coupon system.

- `addItem(item)` — if `source` is missing it defaults to `"legacy"`; if `currency` is missing it defaults to `config.current.currency`.
- `removeItem(id)`.
- `changeQuantity(id, delta)` — clamped to `>= 1`.
- `updateItem(id, partial)`.
- `recalculate()` — re-runs notify without mutating state.
- `notify()` — recomputes coupon math from `config.current` and fires `onTotalUpdated(total, coupons)` + `onCouponAlert(showAlert, remaining)`.

Singleton: `export const listManager = new ListManager()`.

---

### `ui.ts`

Lazy DOM getters and the row-rendering helper.

`uiRefs` exposes every element accessed by `main.ts`, including the new AI-image option inputs: `inputAiEndpoint`, `inputAiModel`, `inputAiTimeout`, `inputAiKey`, `chkAiUseProxy`, `chkRequireConfirm`, and the in-modal scan elements (`addSpinner`, `addAiResults`, `addAnalyzeCancel`, `addRowNew`, `addSwitchManual`).

`addResultItem(item, isError?, onEdit?)` renders one row in `#result-list` and registers it with `listManager`.

`populateSelect` and `updateThresholdLabel` are unchanged helpers.

---

### `modal.ts`

Generic slide-in modal base class. `open()`, `close()`, `get opened`.

---

### `tutorial.ts`

Self-contained tutorial content for Italian and English.

- `translations: Record<Lang, TutorialContent>` — IT + EN trees. The "Analisi IA dell'immagine" / "Image AI Analysis" section explains the privacy boundary (image only goes to the configured endpoint when the user scans) and how to obtain a key from the chosen provider.
- `renderTutorial(lang)` — renders the tree to HTML.
- `getOptionTooltips(lang)` — produces `{ label → description }` for the options modal, including `"AI Endpoint"`, `"AI Model"`, `"AI Timeout"`, `"AI Key"`, `"Use AI Proxy"`, `"Require Manual Confirm"`.

---

### `yamlConfig.ts`

Lightweight YAML parser and serialiser for config import/export. No external YAML library is used.

- `parseSimpleYaml(text)` — supports flat `key: value`, nested map blocks, blank lines, and `#` comments. Unknown keys are silently ignored, so legacy exports referencing OCR fields still load without throwing.
- `applyYamlToModal(data, uiRefs)` — writes recognised values into the form fields, validating types and enum membership.
- `exportConfigYaml(cfg)` — serialises the current `AppConfigData` (including all `ai*` fields and `schemaVersion`).

---

### `main.ts`

Application entry point. Bootstraps services, injects modals, and binds event listeners.

#### Initialisation sequence

1. Creates `CameraService`, injects all three modals, runs `initOptionTooltips()` and `initTutorialLang()`.
2. `populateOptions()` reads `config.current` and fills the options form.
3. Registers `listManager` listeners for totals/coupon alerts.
4. Registers `config.onChanged(() => listManager.recalculate())`.

#### `doScan()`

1. Guards against concurrent runs with a `scanning` flag.
2. Calls `camera.captureCropped(cropVal)`.
3. Delegates to `openAddModalForScan(base64)` in `addModalController.ts`.

#### Event listeners

| Element | Event | Action |
|---|---|---|
| `#btn-scan` | `click` | `doScan()` |
| `#btn-options` | `click` | populate form + open options modal |
| `#btn-add` | `click` | `openAddModalForManual()` |
| `#btn-tutorial` | `click` | open tutorial modal |
| `#crop-slider` | `input` | update `maskTop` / `maskBottom` heights |
| `#opt-save` | `click` | read form, `config.save(...)`, close |
| `#btn-opt-export` | `click` | download `config.yml` via `exportConfigYaml` |
| `#input-import` | `change` | `parseSimpleYaml` → `applyYamlToModal` |

---

### `modals/optionsModal.ts`

- `createOptionsModal()` — injects `optionsModal.html` once and returns a `Modal` for `#options-panel` / `#options-overlay`.
- `initOptionTooltips()` — event-delegated tooltips driven by `data-tip` attributes; descriptions come from `getOptionTooltips(lang)`.
- The HTML contains the new AI fields (`#opt-ai-endpoint`, `#opt-ai-model`, `#opt-ai-timeout`, `#opt-ai-key`, `#opt-ai-use-proxy`, `#opt-require-confirm`) and a visible `.opt-warning` reminding the user never to commit the API key.

---

### `modals/addModal.ts`

`createAddModal()` injects `addModal.html` (once) and returns a `Modal` for `#add-panel` / `#add-overlay`.

The HTML defines three regions controlled by the body classes `mode-analyze` / `mode-results` / `mode-manual`:

- **Analyze**: `#add-spinner` ("Analisi IA in corso…") and `#add-analyze-cancel`.
- **Results**: editable rows inside `#add-ai-results`, `#add-row-new` to append a row, and the Conferma / Annulla buttons.
- **Manual**: single-product form (product / price / qty) reused for both manual entry and editing existing items.

---

### `modals/addModalController.ts`

Orchestrates the modal in its three modes:

- `openAddModalForScan(base64)` — opens in `mode-analyze`, calls `sendImageToAI(base64, IMAGE_EXTRACTION_PROMPT, …)` with an `AbortController` wired to `#add-analyze-cancel`, then renders editable rows (`mode-results`). When `requireManualConfirm` is `false`, items are added to `listManager` immediately and the modal closes.
- `openAddModalForManual()` — opens directly in `mode-manual`.
- `openAddModalForEdit(item)` — opens `mode-manual` prefilled with the item's fields.

Items added via the AI rows get `source: "ai"`; items entered via the manual form get `source: "manual"`.

---

### `modals/tutorialModal.ts`

- `createTutorialModal()` — injects `tutorialModal.html` once.
- `initTutorialLang()` — reads `localStorage["tutorialLang"]` (default `"it"`), applies it, and wires `#btn-lang-it` / `#btn-lang-en`.

---

## Public Assets

### `public/manifest.json`
Standard PWA manifest. Name, short name, icons (192×192 and 512×512), `display: standalone`, theme colour.

### `public/sw.js`
Minimal Service Worker: `install` (skipWaiting), `activate` (claim), `fetch` (network pass-through). The SW enables PWA installation but does not implement offline support.

---

## Test Suite

All tests live in `tests/` and run with Vitest (jsdom environment).

| File | Module under test | Key scenarios |
|---|---|---|
| `models.test.ts` | `models.ts` | `generateId` monotonicity, `createPriceItem` defaults, unique IDs |
| `config.test.ts` | `config.ts` | Defaults, round-trips of all `ai*` fields, legacy migration to `schemaVersion: 3` |
| `listManager.test.ts` | `listManager.ts` | Add/remove items, quantity clamping, total arithmetic, coupon math, legacy-item defaulting |
| `aiPrompt.test.ts` | `aiPrompt.ts` | `IMAGE_EXTRACTION_PROMPT` snapshot, schema validation, fixture parsing, `toPriceItems` rules |
| `api.test.ts` | `api.ts` | `sendImageToAI` success / envelope / proxy mode / timeout / HTTP error / invalid JSON |
| `addModal.test.ts` | `addModalController` + HTML | Scan success → editable rows → confirm; scan error → manual fallback; `requireManualConfirm: false` auto-add |
| `optionsModal.test.ts` | `optionsModal.ts` | Tooltip wiring, presence of new AI-image controls |
| `tutorial.test.ts` | `tutorial.ts` | IT/EN content includes "Analisi IA" / "Image AI", no OCR references, new tooltip keys present |
| `yamlConfig.test.ts` | `yamlConfig.ts` | Flat values, blank lines, comments, nested blocks, round-trip of new `ai*` fields, silent ignore of legacy keys |

Fixtures used by `aiPrompt.test.ts` and `api.test.ts` live in `tests/fixtures/ai/`.

Run all tests:
```bash
npm test
```

Run with coverage:
```bash
npx vitest run --coverage
```

---

## Data Flow

```
Camera (camera.ts)
  └─ captureCropped(cropRatio)
       │  base64 JPEG
       ▼
openAddModalForScan (modals/addModalController.ts)
       │  mode-analyze → spinner
       ▼
sendImageToAI (api.ts)  ─── /ai-proxy or aiEndpoint ──►  AiExtractionResult
       │
       ▼
toPriceItems (aiPrompt.ts)
       │  editable rows in mode-results
       ▼
user reviews / edits / confirms
       │
       ▼
listManager.addItem  (source: "ai" or "manual")
       │
       ├─► onTotalUpdated ──► update #total-value, #cash-value, #coupon-value
       └─► onCouponAlert  ──► update #coupon-alert banner
```

Config changes (`config.save`) trigger `listManager.recalculate()`, which re-evaluates the coupon logic against the current total and fires all listeners again.

When `requireManualConfirm` is `false`, the controller skips the editable step and adds items directly after `sendImageToAI` resolves.
