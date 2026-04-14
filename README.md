# Keep The Check — PWA

A Progressive Web App that helps you track prices while shopping. Point the camera at a price tag or receipt: the app uses OCR + AI to extract product names and prices, updating a running total in real time.

---

## Table of Contents

1. [Tech Stack](#tech-stack)
2. [Project Structure](#project-structure)
3. [Getting Started](#getting-started)
4. [Source Files](#source-files)
   - [models.ts](#modelsts)
   - [config.ts](#configts)
   - [camera.ts](#camerats)
   - [api.ts](#apits)
   - [listManager.ts](#listmanagerts)
   - [ui.ts](#uits)
   - [modal.ts](#modalts)
   - [tutorial.ts](#tutorialts)
   - [yamlConfig.ts](#yamlconfigts)
   - [main.ts](#maints)
   - [modals/optionsModal.ts](#modalsoptionsmodalts)
   - [modals/addModal.ts](#modalsaddmodalts)
   - [modals/tutorialModal.ts](#modalstutorialmodalts)
5. [Public Assets](#public-assets)
6. [Test Suite](#test-suite)
7. [Data Flow](#data-flow)

---

## Tech Stack

| Tool | Role |
|---|---|
| **TypeScript 5** | Language |
| **Vite 5** | Dev server & bundler |
| **Vitest 2** | Unit test runner |
| **jsdom** | DOM emulation in tests |
| **OCR Space API** | Image-to-text recognition |
| **Google Gemini API** | AI price extraction |
| **Groq API (Llama 3)** | AI price extraction (alternative / fallback) |

---

## Project Structure

```
keep-the-check-pwa/
├── index.html             # App shell — static HTML skeleton
├── vite.config.ts         # Vite build configuration
├── vitest.config.ts       # Vitest test configuration
├── tsconfig.json          # TypeScript compiler options
├── package.json           # NPM scripts and dependencies
├── generateIcons.mjs      # Script to generate PWA icons with sharp
├── public/
│   ├── manifest.json      # PWA manifest (name, icons, display mode)
│   └── sw.js              # Service Worker (network-first pass-through)
└── src/
    ├── main.ts            # App entry point — wires everything together
    ├── models.ts          # Shared data types and factory functions
    ├── config.ts          # Persistent configuration service
    ├── camera.ts          # Camera access and image capture
    ├── api.ts             # OCR and AI API calls
    ├── listManager.ts     # Shopping list state and total logic
    ├── ui.ts              # DOM references and result item rendering
    ├── modal.ts           # Generic modal base class
    ├── tutorial.ts        # Tutorial content (IT/EN) and rendering
    ├── yamlConfig.ts      # YAML config import/export
    ├── style.css          # Global styles
    └── modals/
        ├── addModal.html          # Manual-add modal markup
        ├── addModal.ts            # Manual-add modal factory
        ├── optionsModal.html      # Options modal markup
        ├── optionsModal.ts        # Options modal factory + tooltips
        ├── tutorialModal.html     # Tutorial modal markup
        └── tutorialModal.ts      # Tutorial modal factory + language switch
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

## Source Files

### `models.ts`

Shared data types, enums, and factory functions. Has zero dependencies on other source files.

#### Enums

| Enum | Values | Purpose |
|---|---|---|
| `OcrProvider` | `OcrSpace` | Supported OCR backends |
| `AiProvider` | `Gemini`, `Groq` | Supported AI backends |
| `CurrencyCode` | `EUR`, `USD`, `GBP`, … (20 total) | ISO 4217 currency codes |

#### Interfaces

| Interface | Fields | Purpose |
|---|---|---|
| `PriceItem` | `id: number`, `product: string`, `price: number`, `quantity: number` | A single item in the shopping list |
| `PriceResult` | `items: PriceItem[]` | The parsed response from the AI |

#### Functions

##### `generateId(): number`
Increments and returns a module-level counter `_nextId`. Guarantees unique IDs within a session.

##### `createPriceItem(product: string, price: number): PriceItem`
Factory that builds a `PriceItem` with `quantity: 1` and a fresh ID from `generateId()`.

---

### `config.ts`

Persistent application configuration stored in `localStorage`. Provides a reactive service with change listeners.

#### Constants

- `CURRENCIES: CurrencyEntry[]` — Array of `{ code: CurrencyCode, symbol: string }` entries covering all 20 supported currencies.
- `DEFAULTS: AppConfigData` — The initial/fallback configuration object.
- `STORAGE_KEY = "appConfig"` — `localStorage` key.

#### Interface `AppConfigData`

| Field | Type | Default | Description |
|---|---|---|---|
| `currency` | `CurrencyCode` | `EUR` | Active currency |
| `aiProvider` | `AiProvider` | `Gemini` | Active AI backend |
| `ocrProvider` | `OcrProvider` | `OcrSpace` | Active OCR backend |
| `ocrEngine` | `string` | `"1"` | OCR Space engine number (1–3) |
| `ocrIsTable` | `boolean` | `false` | Treat image as tabular data |
| `useOcr` | `boolean` | `true` | Enable OCR step |
| `useCoupons` | `boolean` | `false` | Enable coupon system |
| `couponValue` | `number` | `0` | Spend required per coupon (€) |
| `couponAlertThreshold` | `number` | `0.2` | Alert fraction of `couponValue` (0.05–0.30) |
| `ocrApiKeys` | `Record<string, string>` | `{ OcrSpace: "" }` | Per-provider OCR API keys |
| `aiApiKeys` | `Record<string, string>` | `{ Gemini: "", Groq: "" }` | Per-provider AI API keys |

#### Class `ConfigService`

##### `constructor(storage?: Storage)`
Accepts an optional `Storage` instance (defaults to `localStorage`). Merges any saved JSON from `STORAGE_KEY` onto `DEFAULTS`.

##### `get current(): Readonly<AppConfigData>`
Read-only snapshot of the current configuration.

##### `save(partial: Partial<AppConfigData>): void`
Merges `partial` into `data`, persists the full object to storage and fires all listeners.

##### `onChanged(fn: () => void): void`
Registers a callback invoked on every `save()`.

##### `removeListener(fn: () => void): void`
Deregisters a previously registered callback.

##### `getCurrencySymbol(): string`
Returns the Unicode symbol for the active currency, e.g. `"€"`, `"$"`. Returns `"?"` for unknown codes.

##### `getAiApiKey(): string`
Returns the API key for the currently active `aiProvider`.

##### `getOcrApiKey(): string`
Returns the API key for the currently active `ocrProvider`.

#### Singleton export
`export const config = new ConfigService()` — the single shared instance used throughout the app.

---

### `camera.ts`

Wraps the browser `MediaDevices` API to access the rear camera and capture frames.

#### Class `CameraService`

##### `constructor(video: HTMLVideoElement)`
Stores a reference to the `<video>` element used as the live preview.

##### `async start(): Promise<void>`
Requests the environment-facing camera at ideal 1920×1080, assigns the stream to `video.srcObject` and calls `play()`.

##### `stop(): void`
Stops all tracks, sets `stream` to `null` and clears `video.srcObject`.

##### `get isActive(): boolean`
Returns `true` if a stream exists and is still active.

##### `capture(): string | null`
Draws the current video frame to a full-resolution `<canvas>` and returns the JPEG base64 payload (quality 0.75). Returns `null` if the camera is not active.

##### `captureCropped(cropRatio: number): string | null`
More sophisticated capture that accounts for `object-fit: cover` rendering:
1. Computes the visible source rectangle by comparing the video's aspect ratio to the container's aspect ratio.
2. Applies the `cropRatio` (0–1) from the slider: `cropAmount = srcH × cropRatio × 0.75`, trimmed equally from top and bottom.
3. Draws the resulting rectangle to a canvas and returns base64 JPEG.

Returns `null` if the camera is not active.

---

### `api.ts`

Pure async functions for the OCR and AI pipeline. No side effects; no DOM access.

#### Constants

| Constant | Value |
|---|---|
| `OCR_ENDPOINT` | `https://api.ocr.space/parse/image` |
| `GEMINI_ENDPOINT` | Gemini 2.0 Flash Lite generateContent URL |
| `GROQ_ENDPOINT` | `https://api.groq.com/openai/v1/chat/completions` |
| `PROMPT` | System prompt instructing the AI to return `{"items":[…]}` JSON |

#### Interface `OcrOptions`

| Field | Type | Description |
|---|---|---|
| `engine?` | `string` | OCR Space engine number |
| `isTable?` | `boolean` | Hint for tabular data |

#### `async recognizeOcr(base64, apiKey, language?, options?): Promise<string>`

Posts a `FormData` request to OCR Space with the JPEG image encoded as a base64 data URI.

| Parameter | Type | Description |
|---|---|---|
| `base64` | `string` | JPEG image as base64 |
| `apiKey` | `string` | OCR Space API key |
| `language` | `string` | Language hint (default `"ita"`) |
| `options` | `OcrOptions` | Engine and table flag |

**Returns** the raw text from `ParsedResults[0].ParsedText`.  
**Throws** if the HTTP request fails, if `IsErroredOnProcessing` is true, or if `ParsedResults` is empty.

#### `async parseWithGemini(ocrText, apiKey): Promise<PriceResult>`

Sends the OCR text wrapped in `PROMPT` to the Gemini REST API.

**Returns** a `PriceResult` parsed from the model's JSON response.  
**Throws** on HTTP errors, missing candidates, or invalid/empty JSON.

#### `async parseWithGroq(ocrText, apiKey): Promise<PriceResult>`

Sends the OCR text to Groq's OpenAI-compatible chat completions endpoint with `llama-3.1-8b-instant`.

**Returns** a `PriceResult` parsed from `choices[0].message.content`.  
**Throws** on HTTP errors, missing choices, or invalid/empty JSON.

#### `function cleanAndParse(text: string): PriceResult` *(internal)*

Strips optional Markdown code fences (` ```json … ``` `) from the model's response, then calls `JSON.parse`. Validates that `result.items` is a non-empty array.

**Throws** `"AI returned invalid JSON: …"` or `"AI: no prices recognized"`.

---

### `listManager.ts`

Stateful shopping list. Tracks items, computes the total, and evaluates the coupon system.

#### Class `ListManager`

Internal state:
- `items: Map<number, PriceItem>` — keyed by `item.id`
- `_total: number` — running sum of `price × quantity` for all items
- `totalListeners`, `alertListeners` — callback arrays

##### `get total(): number` / `get count(): number`
Read-only accessors for the running total and item count.

##### `onTotalUpdated(fn: TotalListener): void`
Registers `fn(total, coupons)` called after every mutation.

##### `onCouponAlert(fn: AlertListener): void`
Registers `fn(show, remaining)` called after every mutation.

##### `addItem(item: PriceItem): void`
Inserts the item into the map, adds `price × quantity` to `_total`, calls `notify()`.

##### `removeItem(id: number): void`
Looks up the item; if found, removes it and subtracts `price × quantity` from `_total`, calls `notify()`.

##### `changeQuantity(id: number, delta: number): void`
Clamps the new quantity to `Math.max(1, quantity + delta)`, updates `_total` by the difference, calls `notify()`.

##### `recalculate(): void`
Re-fires `notify()` without mutating state. Used when config changes (e.g. coupon settings toggled).

##### `notify(): void`
Reads current config. If `useCoupons` and `couponValue > 0`:
- `coupons = floor(total / couponValue)`
- `remaining = nextMultiple − total`
- `showAlert = remaining ≤ couponValue × couponAlertThreshold`

Fires all `totalListeners` with `(total, coupons)` and all `alertListeners` with `(showAlert, remaining)`.

#### Singleton export
`export const listManager = new ListManager()` — the single shared instance.

---

### `ui.ts`

DOM references and the result-item rendering function. Two concerns kept in one file: the `uiRefs` proxy object and `addResultItem`.

#### `uiRefs`

A plain object where every property is a **lazy getter** that queries the DOM on each access. This avoids null-reference errors when modals haven't been injected yet.

Key refs: `video`, `maskTop`, `maskBottom`, `spinner`, `alertEl`, `cashSection`, `cashValue`, `couponSection`, `couponValue`, `totalValue`, `resultList`, `cropSlider`, `btnOptions`, `btnAdd`, `btnScan`, `btnTutorial`, `selAi`, `selOcrEngine`, `selCurrency`, `chkCoupons`, `inputCouponVal`, `sliderThreshold`, `thresholdLabel`, `inputOcrKey`, `inputAiKey`, and several more for form controls.

#### `addResultItem(item: PriceItem, isError?: boolean): void`

Renders one row in `#result-list` and registers it with `listManager`.

Steps:
1. Creates a `div.result-item` (adds `error` class if `isError`).
2. Appends a `span.product` with `item.product`.
3. If **not** an error:
   - Creates `div.qty-controls` with `−` / quantity / `+` buttons.
   - Each button calls `listManager.changeQuantity()` and refreshes the displayed price.
4. Appends `span.price` with `(price × quantity).toFixed(2) + symbol`.
5. Appends a `×` remove button: calls `listManager.removeItem()` (skipped for errors) and removes the DOM element.
6. Calls `listManager.addItem(item)` (skipped for errors).

#### `populateSelect(select, values, current): void`

Clears a `<select>`, populates it with `<option>` elements from `values`, and sets the selected option to `current`.

#### `updateThresholdLabel(value: number, label: HTMLElement): void`

Formats `value` as a percentage string (e.g. `"20%"`) and sets `label.textContent`.

---

### `modal.ts`

Generic base class for all slide-in modals.

#### Class `Modal`

##### `constructor(panelId: string, overlayId: string)`
Looks up the panel and overlay elements by ID. Registers a click listener on the overlay that calls `close()`.

##### `open(): void`
Guards against double-open. Adds `visible` to the overlay and `open` to the panel.

##### `close(): void`
Guards against double-close. Removes `open` and `visible`.

##### `get opened(): boolean`
Returns the internal `isOpen` flag.

---

### `tutorial.ts`

Self-contained tutorial content for Italian and English, plus rendering and tooltip extraction.

#### Types

- `Lang = "it" | "en"`
- `TutorialInlinePart` — a plain string or `{ text, href }` link object.
- `TutorialItem` — a single part or an array of parts (for mixed text+link lines).
- `TutorialSection` — `{ title, items, ordered?, note? }`.
- `TutorialContent` — `{ sections: TutorialSection[] }`.

#### Data

`const it: TutorialContent` and `const en: TutorialContent` — hardcoded tutorial trees with eight sections each: app purpose, scanning, manual add, item list, totals/coupons, options, Gemini API key, Groq API key, OCR Space API key.

`export const translations: Record<Lang, TutorialContent>` — lookup map.

#### `renderTutorial(lang: Lang): string`

Converts the tutorial tree for `lang` to an HTML string. Each section becomes a `div.tutorial-section` containing an `<h3>` title, a `<ul>` or `<ol>` (based on `section.ordered`), and an optional `<p class="tutorial-note">`.

Link parts are rendered as `<a target="_blank" rel="noopener noreferrer">`.

#### `getOptionTooltips(lang: Lang): Record<string, string>`

Finds the "Options" section in `translations[lang]` and builds a `{ label → description }` map from items of the form `"Label: description"`. Parenthesised suffixes in the label (e.g. `"Import (📁)"` → `"Import"`) are stripped with a regex.

---

### `yamlConfig.ts`

Lightweight YAML parser and serialiser for config import/export. No external YAML library is used.

#### `parseSimpleYaml(text: string): Record<string, unknown>`

Line-by-line parser supporting:
- **Blank lines and `#` comments** — skipped.
- **Flat key: value** — stored as strings.
- **Nested map blocks** — a key with an empty value followed by indented `key: value` lines produces a `Record<string, string>`.

Returns a plain object with string values (or nested string maps).

#### `applyYamlToModal(data, uiRefs): void`

Takes the parsed YAML object and writes matching values into the options modal form fields. Validates types and enum membership before assigning. Handles: `aiProvider`, `currency`, `useCoupons`, `couponValue`, `couponAlertThreshold`, `ocrApiKeys`, `aiApiKeys`, `ocrEngine`, `ocrIsTable`.

#### `exportConfigYaml(cfg): string`

Serialises the current `AppConfigData` to a YAML string. Nested maps (`ocrApiKeys`, `aiApiKeys`) are indented with two spaces.

---

### `main.ts`

Application entry point. Bootstraps all services and binds all event listeners. No business logic lives here — it delegates to the other modules.

#### Initialisation sequence

1. Imports styles, creates `CameraService`, injects all three modals into the DOM, calls `initOptionTooltips()` and `initTutorialLang()`.
2. `populateOptions()` — reads `config.current` and fills the options form fields.
3. Registers all `listManager` listeners for UI updates (totals, coupon alert).
4. Registers `config.onChanged(() => listManager.recalculate())` so coupon calculations refresh when settings change.

#### Key functions

##### `populateOptions(): void`
Reads `config.current` and writes all values into the options form (selects, inputs, checkboxes, slider).

##### `async callAiWithFallback(ocrText): Promise<PriceResult>`
Tries the primary AI provider. If it throws, tries the other provider as a fallback (only if a key for it exists). If both fail, throws a combined error message.

##### `async doScan(): Promise<void>`
The main scan pipeline, guarded by a `scanning` boolean to prevent parallel calls:
1. Shows spinner, disables scan button.
2. Calls `camera.captureCropped(cropVal)`.
3. Calls `recognizeOcr(...)`.
4. Calls `callAiWithFallback(ocrText)`.
5. For each item in the result, calls `createPriceItem` + `addResultItem`.
6. On error, adds a red error row via `addResultItem(..., true)`.
7. Always hides spinner and re-enables button.

#### Event listeners wired up

| Element | Event | Action |
|---|---|---|
| `#btn-scan` | `click` | `doScan()` |
| `#btn-options` | `click` | populate form + `optionsModal.open()` |
| `#btn-add` | `click` | reset form + `addModal.open()` |
| `#btn-tutorial` | `click` | `tutorialModal.open()` |
| `#crop-slider` | `input` | update `maskTop`/`maskBottom` heights |
| `#opt-save` | `click` | read form, call `config.save(...)`, close modal |
| `#add-confirm` | `click` | validate, `createPriceItem`, `addResultItem`, close |
| `#btn-opt-export` | `click` | `exportConfigYaml` → download `config.yml` |
| `#input-import` | `change` | `FileReader` → `parseSimpleYaml` → `applyYamlToModal` |

---

### `modals/optionsModal.ts`

#### `createOptionsModal(): Modal`
Injects `optionsModal.html` into `document.body` (once) and returns a `Modal` instance for `#options-panel` / `#options-overlay`.

#### `initOptionTooltips(): void`
Uses **event delegation** on `#options-panel`. On every click, checks whether the target (or a closest ancestor) has class `.opt-tip`. If so, reads `data-tip`, looks up the localized description via `getOptionTooltips(lang)`, and calls `showTooltip()`.

#### `showTooltip(anchor, text): void` *(internal)*
Dismisses any existing tooltip, creates a `div.opt-tooltip`, appends it to the panel, positions it below the `?` icon using `getBoundingClientRect()`, and schedules auto-dismiss after 3 000 ms.

#### `dismissTooltip(): void` *(internal)*
Clears the pending timeout and removes the tooltip element.

---

### `modals/addModal.ts`

#### `createAddModal(): Modal`
Injects `addModal.html` (once) and returns a `Modal` for `#add-panel` / `#add-overlay`.

---

### `modals/tutorialModal.ts`

#### `createTutorialModal(): Modal`
Injects `tutorialModal.html` (once) and returns a `Modal` for `#tutorial-panel` / `#tutorial-overlay`.

#### `initTutorialLang(): void`
Reads the saved language from `localStorage` (key `"tutorialLang"`, default `"it"`), applies it, and registers click listeners on `#btn-lang-it` / `#btn-lang-en`.

#### `applyLang(lang: Lang): void` *(internal)*
Calls `renderTutorial(lang)` and sets `#tutorial-content.innerHTML`. Toggles the `lang-active` CSS class on the two language buttons.

---

## Public Assets

### `public/manifest.json`
Standard PWA manifest. Defines app name, short name, icons (192×192 and 512×512), `display: standalone`, theme colour.

### `public/sw.js`
Minimal Service Worker:
- `install` — calls `skipWaiting()` to activate immediately.
- `activate` — calls `clients.claim()` to take control of open pages.
- `fetch` — passes all requests through to the network (no caching).

The SW enables the app to be installed as a PWA but does not implement offline support.

---

## Test Suite

All tests live in `tests/` and run with Vitest (jsdom environment).

| File | Module under test | Type | Key scenarios |
|---|---|---|---|
| `models.test.ts` | `models.ts` | Unit | `generateId` monotonicity, `createPriceItem` fields, unique IDs |
| `config.test.ts` | `config.ts` | Unit | Defaults, `save`/load round-trip, `onChanged`/`removeListener`, currency symbols |
| `listManager.test.ts` | `listManager.ts` | Unit + integration | add/remove items, quantity clamping, total arithmetic, coupon logic, alert thresholds, `recalculate` |
| `api.test.ts` | `api.ts` | Unit (mocked fetch) | OCR success/HTTP-error/processing-error, Gemini and Groq success/HTTP-error/invalid-JSON/empty-items, markdown-wrapped JSON stripping |
| `tutorial.test.ts` | `tutorial.ts` | Unit | `renderTutorial` structure (sections, ol/ul, notes, links, IT≠EN), `getOptionTooltips` map validity, key sanitisation |
| `yamlConfig.test.ts` | `yamlConfig.ts` | Unit | Flat values, blank lines, comments, nested blocks, CRLF, empty input, EOF flush |

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
recognizeOcr (api.ts)   ─── OCR Space API ──►  raw text
       │
       ▼
callAiWithFallback (main.ts)
  ├─ parseWithGemini (api.ts) ─── Gemini API ──► PriceResult
  └─ parseWithGroq   (api.ts) ─── Groq API   ──► PriceResult (fallback)
       │
       ▼
createPriceItem (models.ts)
       │
       ▼
addResultItem (ui.ts)  ──► DOM row rendered
       │
       ▼
listManager.addItem (listManager.ts)
       │
       ├─► onTotalUpdated ──► update #total-value, #cash-value, #coupon-value
       └─► onCouponAlert  ──► update #coupon-alert banner
```

Config changes (`config.save`) trigger `listManager.recalculate()`, which re-evaluates the coupon logic against the current total and fires all listeners again.
