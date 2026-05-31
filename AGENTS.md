# AGENTS.md

## Purpose
This file helps coding agents become productive quickly in this repository.
Use it as a behavior guide, and link to existing docs instead of duplicating content.

## First Commands
- Install dependencies: npm install
- Start dev server: npm run dev
- Run full test suite: npm test
- Run tests in watch mode: npm run test:watch
- Build production bundle: npm run build
- Preview production bundle: npm run preview

Detailed setup and architecture overview: [README.md](README.md)

## High-Value Files
- App entrypoint and wiring: [src/main.ts](src/main.ts)
- AI transport and fallback orchestration: [src/api.ts](src/api.ts)
- AI extraction contract and parser: [src/aiPrompt.ts](src/aiPrompt.ts)
- Persistent app config and provider presets: [src/config.ts](src/config.ts)
- Add modal AI flow: [src/modals/addModalController.ts](src/modals/addModalController.ts)
- Options modal UI: [src/modals/optionsModal.ts](src/modals/optionsModal.ts), [src/modals/optionsModal.html](src/modals/optionsModal.html)
- Shopping list state and totals: [src/listManager.ts](src/listManager.ts)
- UI refs and rendering helpers: [src/ui.ts](src/ui.ts)
- YAML import and export behavior: [src/yamlConfig.ts](src/yamlConfig.ts)

## Guardrails For AI Features
- Do not change the public signature of sendImageToAI in [src/api.ts](src/api.ts) unless explicitly requested.
- Keep response parsing compatible with parseAiExtractionJson in [src/aiPrompt.ts](src/aiPrompt.ts).
- Fallback orchestration must include only providers that are both enabled and have a non-empty API key.
- Preserve proxy safety: when proxy mode is enabled, do not attach client-side Authorization headers.
- Do not commit real keys or secrets. Use placeholders only.

Proxy and security notes: [README.md](README.md)

## Mandatory Testing Gate
Every change must be backed by test design (or redesign), test implementation, and test execution.
This is mandatory for code changes and for any behavior-impacting refactor.

Required loop for every change:
1. Define or redefine the test cases for the modified behavior before finalizing code.
2. Implement or update those tests in the relevant test files.
3. Run targeted tests for the changed area.
4. Run the full suite.
5. Repeat until all designed/updated tests and the full suite are green.

Hard stop rule for agents:
- Agents must not stop while any designed test is failing, missing, or not executed.
- Agents must provide evidence that the change works by reporting:
	- which tests were designed/redefined,
	- which test files were updated,
	- which commands were run,
	- the final passing result.

Commit and push practice after objective validation:
- Once validity and correctness are objectively demonstrated (designed/redefined tests implemented and all green), agents should commit the change.
- The commit message should summarize the behavior change and the validated test scope.
- After commit, agents should push the validated change to the remote branch.
- Commit/push must not happen when designed tests are missing, failing, or not executed.

Area mapping for targeted runs:
- API transport or fallback: [tests/api.test.ts](tests/api.test.ts)
- Config schema or migration: [tests/config.test.ts](tests/config.test.ts)
- Add modal AI flow: [tests/addModal.test.ts](tests/addModal.test.ts)
- Options UI changes: [tests/optionsModal.test.ts](tests/optionsModal.test.ts)
- Parsing contract updates: [tests/aiPrompt.test.ts](tests/aiPrompt.test.ts)
- List and totals behavior: [tests/listManager.test.ts](tests/listManager.test.ts)
- YAML import/export behavior: [tests/yamlConfig.test.ts](tests/yamlConfig.test.ts)
- Tutorial content/tooltips behavior: [tests/tutorial.test.ts](tests/tutorial.test.ts)
- Model helpers and IDs: [tests/models.test.ts](tests/models.test.ts)

Execution commands:
- Targeted test run: npm test -- tests/<area>.test.ts
- Full validation gate: npm test

## Optimized Future-Test Skill (Derived From Current Suite)
Skill name: Behavior-Contract Matrix with Deterministic Harness

1. Design tests by behavior contracts, not implementation details:
- Name tests as observable outcomes (input -> output/side effect).
- Cover happy path, error path, and edge path for each changed contract.

2. Reuse deterministic harness patterns already proven in this repo:
- Local factories/builders for complex payloads (for example, makeResult/provider/defaultCfg).
- Stable fixtures from [tests/fixtures/ai](tests/fixtures/ai) for parser and transport scenarios.
- Explicit mocks/spies at boundaries (fetch, storage, event handlers, timers).

3. Use scenario-specific assertions by domain:
- API: payload shape, auth/proxy safety, fallback order, timeout/abort/network errors.
- Config/migrations: round-trip persistence, schema upgrades, idempotence/no extra writes.
- UI/DOM: stable IDs, wiring, hidden/visible states, critical text and controls.
- Data/model logic: totals math, quantity updates, backward-compat shape migration.

4. Execution workflow for each change:
- Fast loop: run only impacted test files first.
- Safety loop: run full suite.
- Completion gate: no failing designed tests, no unexecuted designed tests.

5. Redefinition rule on every modification:
- Re-check existing tests for relevance whenever behavior changes.
- If a test no longer represents the intended behavior, rewrite it in the same change.
- Do not leave stale tests as technical debt for later.

## Change Style
- Keep changes minimal and focused.
- Avoid unrelated refactors in the same patch.
- Preserve naming and existing patterns in src and tests.
- Update [README.md](README.md) when behavior or configuration changes.

## Documentation Inventory
Primary source of truth for project behavior and configuration:
- [README.md](README.md)

Template for local proxy environment variables:
- [.env.example](.env.example)
