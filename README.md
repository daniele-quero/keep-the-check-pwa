# Keep The Check — PWA

A Progressive Web App that helps you track prices while shopping. Point the camera at a price tag or receipt: the app sends the image to a **server-side proxy** (Netlify Functions), which forwards it to an AI vision provider using a key stored in Netlify Environment Variables. The provider returns a structured list of products and prices. You review and edit the result, then save items to a running total. **API keys never reach the browser.**

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
   - [providerCatalog.ts](#providercatalogts)
   - [providerSelection.ts](#providerselectionts)
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
| **Netlify Functions** | Server-side AI proxy — keeps provider API keys off the client |
| **AI Vision API** | Image-to-structured-JSON extraction (provider selected from a server-side registry) |

---

## Project Structure

```
keep-the-check-pwa/
├── index.html             # App shell — static HTML skeleton
├── vite.config.ts         # Vite build configuration
├── vitest.config.ts       # Vitest test configuration
├── tsconfig.json          # TypeScript compiler options
├── package.json           # NPM scripts and dependencies
├── netlify.toml           # Production redirects + functions config (Node 20, esbuild)
├── generateIcons.mjs      # Script to generate PWA icons with sharp
├── .env.example           # Template AI_KEY_<PROVIDER> env vars for the Netlify Functions
├── netlify/
│   └── functions/
│       ├── ai-providers.ts        # GET registry: which providers exist and have a key
│       └── ai-proxy.ts            # POST proxy: injects key, cyclic server-side fallback
├── public/
│   ├── manifest.json      # PWA manifest
│   └── sw.js              # Service Worker (network-first pass-through)
└── src/
    ├── main.ts            # App entry point — wires everything together
    ├── models.ts          # Shared data types and factory functions
    ├── config.ts          # Persistent configuration service (schemaVersion: 5)
    ├── providerCatalog.ts # Server-side provider registry (endpoints, models, env keys)
    ├── providerSelection.ts # Client temporary provider selection (sessionStorage, 1h TTL)
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

## Mobile-only access

- The PWA is intended for phone/tablet usage only.
- If opened from a desktop/laptop browser, the app is blocked and shows an English notice inviting the user to switch to a mobile device.
- For desktop QA only, you can append `?forceMobile=1` to bypass the gate (example: `http://localhost:5173/?forceMobile=1`).

---

## AI Image Analysis Configuration

API keys live **only** on the server as Netlify Environment Variables. The browser never receives a key. The scan pipeline posts the captured JPEG (base64) plus the verbatim extraction prompt from `src/aiPrompt.ts` to the `ai-proxy` Netlify Function, which injects the key and forwards the request to the selected AI provider. It expects a JSON response matching the schema declared in `aiPrompt.ts` (`version`, `products[]`, `image_text`, `metadata`, `warnings`, `uncertain`).

### Netlify Functions

| Function | Method | Endpoint | Role |
|---|---|---|---|
| `ai-providers` | `GET` | `/.netlify/functions/ai-providers` | Returns the provider registry: `{ id, name, model, supportsVision, hasKey }[]`. `hasKey` reflects whether the matching `AI_KEY_*` env var is set on the server. **Never returns the key itself.** |
| `ai-proxy` | `POST` | `/.netlify/functions/ai-proxy` | Injects `Authorization: Bearer <key>` server-side, forwards to the provider, and performs cyclic fallback across all key-bearing vision providers. Returns the provider's JSON verbatim. |

### Provider registry

Providers are defined server-side in [src/providerCatalog.ts](src/providerCatalog.ts) (also imported by the functions). Each entry hard-codes its endpoint, model, and request parameters; only the key is externalised as an env var.

| Provider (`id`) | Endpoint | Model | Env var | Vision | JSON mode |
|---|---|---|---|---|---|
| `google-gemini` | `https://generativelanguage.googleapis.com/v1beta/openai/chat/completions` | `gemini-2.0-flash` | `AI_KEY_GOOGLE_GEMINI` | ✓ | ✓ |
| `groq` | `https://api.groq.com/openai/v1/chat/completions` | `meta-llama/llama-4-scout-17b-16e-instruct` | `AI_KEY_GROQ` | ✓ | ✓ |
| `mistral` | `https://api.mistral.ai/v1/chat/completions` | `pixtral-12b-2409` | `AI_KEY_MISTRAL` | ✓ | ✓ |
| `openrouter` | `https://openrouter.ai/api/v1/chat/completions` | `meta-llama/llama-3.2-11b-vision-instruct:free` | `AI_KEY_OPENROUTER` | ✓ | ✓ |
| `huggingface` | `https://router.huggingface.co/v1/chat/completions` | `Qwen/Qwen2.5-VL-7B-Instruct` | `AI_KEY_HUGGINGFACE` | ✓ | ✗ |
| `xai-grok` | `https://api.x.ai/v1/chat/completions` | `grok-2-vision-1212` | `AI_KEY_XAI_GROK` | ✓ | ✓ |

All entries use `temperature: 0` and `max_tokens: 1024`. Only vision-capable providers (`supportsVision: true`) are offered for image analysis.

### Setting the keys (Netlify)

Set one env var per provider you want to enable. In the Netlify UI: **Site settings → Environment variables**, or via CLI:

```bash
netlify env:set AI_KEY_GROQ "your-groq-key"
netlify env:set AI_KEY_GOOGLE_GEMINI "your-gemini-key"
# …one per provider you want available
```

Locally, copy [.env.example](.env.example) to `.env` and fill the `AI_KEY_*` placeholders. The example file contains placeholders only — **never commit real keys**.

### Server-side fallback policy

- The proxy builds an attempt order: the client-selected provider first, then any `attemptOrder` hints, then every remaining vision provider that has a key on the server — deduplicated.
- Each provider is tried with a 30 s `AbortController` timeout.
- On `401`, `403`, `429`, any `5xx`, or a network/timeout error, the proxy advances to the next provider.
- If no vision provider has a key, the proxy responds `502 no_providers_with_key`. If all attempts fail, it responds `502 all_providers_failed` with the list of attempted providers and statuses.
- The public `sendImageToAI(imageBase64, prompt, opts)` API signature remains unchanged; the client sends its OpenAI-style body to the proxy with an optional `X-Provider-Id` header and **no** `Authorization` header.

### Choosing a provider (client)

The **Options** modal exposes a single **model dropdown** listing every vision provider. Providers without a server key are shown disabled with a `(no key)` suffix (the client learns this from `ai-providers`, never the key value). Selecting one stores a **temporary** choice in `sessionStorage` under `aiProviderSelection` with a 1-hour TTL (see [src/providerSelection.ts](src/providerSelection.ts)); after it expires or the session ends, the server's default fallback order applies again.

### Local development

Run the app together with the functions using the Netlify CLI:

```bash
npm install -g netlify-cli   # once
netlify dev                  # serves the app + /.netlify/functions/*
```

`netlify dev` reads `.env` for the `AI_KEY_*` variables and proxies function calls locally. Plain `npm run dev` serves the SPA but the AI functions will not be available.

---

## Migration from earlier client-side-key builds

Earlier releases stored AI endpoints, models, and API keys in `localStorage`. On the first load after upgrading, `ConfigService` auto-migrates any existing `localStorage["appConfig"]` payload:

- `schemaVersion` is bumped to `5`.
- Legacy keys are stripped, including all client-side AI settings: `aiEndpoint`, `aiModel`, `aiApiKey`, `aiTimeoutMs`, `aiUseProxy`, `aiProviders`, plus the older `ocrProvider`, `ocrEngine`, `ocrIsTable`, `useOcr`, `ocrApiKeys`, `aiProvider`, `aiApiKeys`.
- Preserved fields (`currency`, `useCoupons`, `couponValue`, `couponAlertThreshold`, `requireManualConfirm`) are kept as-is.
- The migrated payload is written back to storage exactly once.

There are no client-side keys to transfer: provider keys now live only in Netlify Environment Variables. Any previously stored key is discarded during migration.

---

## Privacy

- The captured image is **only** transmitted when the user explicitly triggers a scan.
- It is sent **only** to the `ai-proxy` Netlify Function, which forwards it to the selected AI provider using a server-side key.
- API keys are stored **only** as Netlify Environment Variables on the server; the browser never receives them.
- Nothing is uploaded in the background; there is no analytics or telemetry pipeline in this codebase.
- The only client-side AI state is a temporary provider **selection** (an id string, no key) in `sessionStorage` with a 1-hour TTL.

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

#### Types

| Type | Values | Purpose |
|---|---|---|
| `PriceItemSource` | `"ai" \| "manual" \| "legacy"` | Origin of a `PriceItem` |

#### Additional interfaces

| Interface | Fields | Purpose |
|---|---|---|
| `AiExtractedItem` | `name: string \| null`, `price: number`, `currency: string \| null`, `confidence: number` | Flattened AI price result used to create a `PriceItem` |

#### Functions

- `generateId(): number` — monotonically increasing session-unique IDs.
- `createPriceItem(product, price): PriceItem` — factory with `quantity: 1`, `source: "manual"`, and a fresh ID.
- `createItemFromAi(extracted, quantity?): PriceItem` — factory that maps an `AiExtractedItem` to a `PriceItem` with `source: "ai"`.

---

### `config.ts`

Persistent configuration in `localStorage["appConfig"]`. See [AI Image Analysis Configuration](#ai-image-analysis-configuration) for the full field reference.

- `DEFAULTS: AppConfigData` — initial values.
- `STORAGE_KEY = "appConfig"`.
- `CURRENT_SCHEMA_VERSION = 5`.
- `ProviderConfig` — client-side provider descriptor used by `sendImageToAI` when operating in multi-provider mode: `{ id, name, endpointTemplate, model, apiKey, useProxy, enabled, priority, timeoutMs, extraHeaders?, supportsImages, failureThreshold, cooldownMs }`.
- `ConfigService` — reactive service:
       - `constructor(storage?)` — loads from storage and runs legacy-migration when `schemaVersion < 5` or any legacy key is present.
  - `get current(): Readonly<AppConfigData>`.
  - `save(partial)` — merges, persists, fires listeners.
  - `onChanged(fn)` / `removeListener(fn)`.
  - `getCurrencySymbol(): string`.
- Singleton: `export const config = new ConfigService()`.

The AI-related exports `PROVIDERS_ENDPOINT`, `PROXY_ENDPOINT`, and `AI_REQUEST_TIMEOUT_MS` also live here.

---

### `providerCatalog.ts`

Server-side provider registry, imported by both the client (for typing/UI) and the Netlify Functions.

- `ProviderCatalogEntry` — `{ id, name, endpoint, model, envKey, supportsVision, jsonMode, temperature, maxTokens, extraHeaders? }`.
- `PROVIDER_CATALOG` — the six built-in provider entries (see [AI Image Analysis Configuration](#ai-image-analysis-configuration)).
- `getCatalogEntry(id)` — lookup by id.
- `getVisionProviders()` — entries with `supportsVision: true`; the pool eligible for image analysis and fallback.

No API keys are stored here; only the `envKey` name that the server reads from Netlify Environment Variables.

---

### `providerSelection.ts`

Client-side **temporary** provider selection (id only, never a key).

- `SELECTION_TTL_MS = 3_600_000` (1 hour).
- `getSelectedProvider()` — reads `sessionStorage["aiProviderSelection"]`, validates the id against the catalog, and clears it when invalid or expired.
- `setSelectedProvider(id)` — validates against the catalog and stores the id with a timestamp.
- `clearSelection()` — removes the stored selection.

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
- Schema types:
  - `AiPriceType` — union of `"unit_price" | "total_price" | "discount_price" | "old_price" | "price_per_unit" | "other"`.
  - `AiBoundingBox` — `{ x, y, width, height }` in pixels.
  - `AiNameCandidate` — `{ text: string, confidence: number }`.
  - `AiPrice` — single price entry with `raw_text`, `normalized`, `currency`, `confidence`, `type: AiPriceType`, `bounding_box`, optional `notes`.
  - `AiProduct` — product entry with `id`, `name`, `name_confidence`, `name_raw`, `name_candidates`, `prices`, optional `notes`.
  - `AiExtractionMetadata` — `{ processing_ms, model }`.
  - `AiExtractionResult` — top-level extraction envelope: `version`, `products`, `image_text`, `metadata`, `warnings`, `uncertain`.
  - `AiExtractionErrorCode` — `"invalid_json" | "schema_mismatch" | "empty" | "http_error" | "timeout" | "network"`.
- `parseAiExtractionJson(raw: string): AiExtractionResult` — strips Markdown fences, parses, validates required keys. Throws `AiExtractionError("invalid_json")`, `AiExtractionError("schema_mismatch")`, or `AiExtractionError("empty")`.
- `toPriceItems(result, defaultCurrency)` — picks the highest-confidence name and emits one item per `unit_price` / `total_price` entry, skipping `old_price` unless it is the only available price.
- `AiExtractionError` — typed error with a stable `code: AiExtractionErrorCode`.

---

### `api.ts`

Single network function for the scan pipeline. No DOM access.

#### `sendImageToAI(base64, prompt, opts): Promise<AiExtractionResult>`

| Option | Description |
|---|---|
| `endpoint` | Target URL. In proxy mode this is the `ai-proxy` Netlify Function path. |
| `apiKey` | Bearer token. **Not used in proxy mode** — no `Authorization` header is attached. |
| `model` | Optional model identifier. |
| `timeoutMs` | Default 30000 ms; enforced via `AbortController`. |
| `signal` | Optional caller-owned `AbortSignal` (composed with the timeout). |
| `useProxy` | When `true`, posts without an `Authorization` header. |
| `extraHeaders` | Optional extra request headers (e.g. `X-Provider-Id` carrying the client selection). |
| `aiProviders` | Optional `ProviderConfig[]` for client-side multi-provider mode (enabled providers with a non-empty `apiKey`). When at least one enabled provider is present they take precedence over the `endpoint`/`apiKey` legacy path. |

**Provider resolution and fallback (client-side multi-provider mode)**

When `aiProviders` contains at least one enabled provider with a key, `sendImageToAI` resolves the provider list from that array (sorted by `priority`), uses round-robin start rotation stored in `localStorage["aiProviderFallback.nextStartIndex"]`, and iterates over all providers until one succeeds. Failed providers are tracked with a circuit-breaker: after reaching `failureThreshold` consecutive transient failures the provider is blocked for `cooldownMs` milliseconds. The rotation index is advanced on each invocation.

When no configured provider is present, the legacy single-provider path (`endpoint` + optional `apiKey`) is used.

**Provider kinds**

`ProviderKind = "chat" | "replicate"`. The `"replicate"` kind posts an `{ input: { prompt, image } }` body; the `"chat"` kind posts an OpenAI-compatible messages array with an embedded `image_url`. The provider id `"replicate"` selects the Replicate format automatically.

Request headers: `Content-Type: application/json`. In non-proxy mode, `Authorization: Bearer <key>` (or `Token <key>` for Replicate) is added. In proxy mode no auth header is sent.

Response handling: tries the JSON body directly; if it doesn't match the schema, falls back to common envelope shapes (`output_text`, `choices[0].message.content`, Replicate `output`) and re-parses.

Errors are surfaced as `AiExtractionError` with codes: `"timeout"`, `"network"`, `"empty"`, `"http_error"`, `"invalid_json"`, `"schema_mismatch"`.

---

### `listManager.ts`

Stateful shopping list. Tracks items, computes the total, and evaluates the coupon system.

- `addItem(item)` — if `source` is missing it defaults to `"legacy"`; if `currency` is missing it defaults to `config.current.currency`.
- `removeItem(id)`.
- `changeQuantity(id, delta)` — clamped to `>= 1`.
- `updateItem(id, product, price, quantity)` — replaces product name, unit price, and quantity for an existing item and recalculates the total.- `recalculate()` — re-runs notify without mutating state.
- `notify()` — recomputes coupon math from `config.current` and fires `onTotalUpdated(total, coupons)` + `onCouponAlert(showAlert, remaining)`.

Singleton: `export const listManager = new ListManager()`.

---

### `ui.ts`

Lazy DOM getters and the row-rendering helper.

`uiRefs` exposes every element accessed by `main.ts`, including the single AI-provider dropdown `selAiModel` (`#opt-ai-model`), `chkRequireManualConfirm`, and the in-modal scan elements (`addSpinner`, `addAiResults`, `addAnalyzeCancel`, `addRowNew`, `addSwitchManual`).

`addResultItem(item, isError?, onEdit?)` renders one row in `#result-list` and registers it with `listManager`.

`populateSelect` and `updateThresholdLabel` are unchanged helpers.

---

### `modal.ts`

Generic slide-in modal base class. `open()`, `close()`, `get opened`.

---

### `tutorial.ts`

Self-contained tutorial content for Italian and English.

- `translations: Record<Lang, TutorialContent>` — IT + EN trees. The "⚙️ Opzioni" / "⚙️ Options" section drives `getOptionTooltips` with colon-separated `key: description` lines.
- `renderTutorial(lang)` — renders the tree to HTML.
- `getOptionTooltips(lang)` — dynamically extracts tooltip keys and descriptions from the Options section of the tutorial content (parses `key: description` lines). Keys present: `"Currency"`, `"AI Image Endpoint"`, `"AI Image Model"`, `"AI Image Key"`, `"AI Image Timeout"`, `"Use Image Proxy"`, `"Require Manual Confirm"`, `"Use Coupons"`, `"Value"`, `"Threshold"`, `"Import"`.

---

### `yamlConfig.ts`

Lightweight YAML parser and serialiser for config import/export. No external YAML library is used.

- `parseSimpleYaml(text)` — supports flat `key: value`, nested map blocks, blank lines, and `#` comments. Unknown keys are silently ignored, so legacy exports referencing OCR or client-side AI fields still load without throwing.
- `applyYamlToModal(data, uiRefs)` — writes recognised values (`currency`, coupon fields, `requireManualConfirm`) into the form fields, validating types and enum membership.
- `exportConfigYaml(cfg)` — serialises the current `AppConfigData` (currency, coupon fields, `requireManualConfirm`, `schemaVersion`). No AI keys or endpoints are ever exported.

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
- `populateModelDropdown(select, providers, selectedId?)` — renders one `<option>` per vision provider; providers without a server key are disabled with a `(no key)` suffix and cannot be preselected.
- The HTML exposes: the AI provider dropdown (`#opt-ai-model`), the `#opt-require-manual-confirm` checkbox, currency selector, coupon fields, and import/export buttons. The `data-tip` keys used in the HTML are `"Currency"`, `"AI Image Model"`, `"Require Manual Confirm"`, `"Use Coupons"`, `"Value"`, `"Threshold"`, `"Import"`.

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

- `openAddModalForScan(base64)` — opens in `mode-analyze`, calls `sendImageToAI(base64, IMAGE_EXTRACTION_PROMPT, …)` with an `AbortController` wired to `#add-analyze-cancel`, then renders editable rows (`mode-results`). When `requireManualConfirm` is `false` **and** the result contains a single product with all non-zero confidence values, items are added to `listManager` immediately and the modal closes.
- `openAddModalForManual()` — opens directly in `mode-manual`.
- `openAddModalForEdit(item)` — opens `mode-manual` prefilled with the item's fields.

Items added via the AI rows get `source: "ai"`; items entered via the manual form get `source: "manual"`.

#### Exported interfaces

| Interface | Purpose |
|---|---|
| `AddModalControllerConfig` | Runtime config snapshot: `proxyEndpoint`, `selectedProviderId?`, `hasAnyProviderWithKey`, `aiTimeoutMs`, `requireManualConfirm` |
| `AddModalControllerDeps` | Dependency injection bag: `sendImageToAI`, `getConfig`, `addItem`, `root`, `prompt`, `onConfirmed?`, `onFallback?` |
| `CollectedItem` | Intermediate item from an editable row: `name`, `price`, `currency`, `confidence`, `type` |

#### Exported functions

- `shouldAutoConfirmAiResult(result, requireManualConfirm): boolean` — returns `true` when `requireManualConfirm` is `false` and the result has exactly one product with all prices having `confidence > 0`. Drives the auto-add path.
- `shouldOpenAddModalAfterScan(result, requireManualConfirm): boolean` — inverse of `shouldAutoConfirmAiResult`; `true` when the modal should remain open for manual review.

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
| `config.test.ts` | `config.ts` | Defaults, coupon/currency round-trips, legacy migration to `schemaVersion: 5`, stripping of all client-side AI keys |
| `providerCatalog.test.ts` | `providerCatalog.ts` | Registry integrity, `getCatalogEntry`, `getVisionProviders` excludes non-vision entries |
| `providerSelection.test.ts` | `providerSelection.ts` | Set/get/clear selection, catalog validation, 1-hour TTL expiry |
| `functions/aiProviders.test.ts` | `netlify/functions/ai-providers.ts` | GET-only, `hasKey` reflects env, key value never leaked |
| `functions/aiProxy.test.ts` | `netlify/functions/ai-proxy.ts` | POST-only, key injection, cyclic fallback, error surface, both body forms |
| `listManager.test.ts` | `listManager.ts` | Add/remove items, quantity clamping, total arithmetic, coupon math, legacy-item defaulting |
| `aiPrompt.test.ts` | `aiPrompt.ts` | `IMAGE_EXTRACTION_PROMPT` snapshot, schema validation, fixture parsing, `toPriceItems` rules |
| `api.test.ts` | `api.ts` | `sendImageToAI` success / envelope / proxy transport / timeout / HTTP error / invalid JSON |
| `addModal.test.ts` | `addModalController` + HTML | Scan success → editable rows → confirm; no-key fallback; proxy header wiring; `requireManualConfirm: false` auto-add |
| `optionsModal.test.ts` | `optionsModal.ts` | Tooltip wiring, model dropdown population, disabled keyless providers |
| `tutorial.test.ts` | `tutorial.ts` | IT/EN content, tooltip key extraction |
| `yamlConfig.test.ts` | `yamlConfig.ts` | Flat values, blank lines, comments, nested blocks, round-trip of non-AI fields, silent ignore of legacy keys |

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
sendImageToAI (api.ts)
       │  POST /.netlify/functions/ai-proxy  (X-Provider-Id, no Authorization)
       ▼
ai-proxy (netlify/functions)  ── injects AI_KEY_* + cyclic fallback ──►  provider
       │  AiExtractionResult (verbatim provider JSON)
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
