# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

Apex is a goal/objective-management app (objectives → sub-objectives → tasks, an Eisenhower matrix, a daily focus, and an AI assistant). It is an **Nx 23 monorepo** with an **Angular 22** client (TypeScript 6), domain/infrastructure libraries, and an **XState** workflow package. The codebase is written in English, but **docs, code comments, UI strings, and commit messages are in French** — match that when editing those.

## Commands

`package.json` has no scripts; everything runs through Nx. Prefix with `npx` (no global install).

| Task | Command |
|------|---------|
| Serve the app (dev) | `npx nx serve apex-client` |
| Build | `npx nx build apex-client` |
| Unit tests (one project) | `npx nx vite:test <project>` |
| Unit tests (all) | `npx nx run-many -t vite:test` |
| Single test file | `npx nx vite:test apex-client -- src/app/path/to/file.spec.ts` |
| Lint | `npx nx lint <project>` |
| Typecheck | `npx nx typecheck <project>` |
| Only what changed | `npx nx affected -t vite:test lint typecheck` |
| Design system check | `npx nx lint design-tokens` |

- The unit test target is `vite:test` (not `test`). Tests are **Vitest + jsdom** via `@analogjs/vite-plugin-angular`; `.spec.ts` files are colocated with sources. E2E is Playwright (`e2e` target) when a project has a Playwright config.
- Project names: `apex-client`, `objective`, `chat`, `ai`, `gemini`, `supabase`, `firebase`, `chore`, `auth`, `ai-assistant`, `apex-library`, `design-tokens`.
- **The workflow package lives under the misspelled directory `worklfows/` — use that exact path.**
- `nx serve apex-client` declares `dependsOn: ["api:serve"]`, but **no `api` project exists** (stale config, also referenced in `nx.json` `release` and `.vscode/launch.json`). If serve fails on a missing `api` dependency, that is why — run `npx nx run apex-client:serve --excludeTaskDependencies`.
- **Node ^22.22.3, ^24.15 or ≥ 26 is required** (Angular 22; Node 25 is not supported). `.nvmrc` pins Node 24.22.0: run `nvm use` first; the system Node in `/usr/local/bin` (24.8) is too old.
- **PrimeNG is deliberately held at v21** (last open-licensed major; v22+ and `@primeuix/themes` 3 / `primeicons` 8 are under the proprietary PrimeUI License and need a key). Its Angular 21 peer ranges are forced to Angular 22 via `overrides` in `package.json`; do not bump `primeng`, `@primeuix/themes` or `primeicons` across a major. Dev builds log a harmless `NG0318` warning from `<p-toast>` (`[style.bottom]` bound to `false`).
- TypeScript 6: `tsconfig.base.json` has no `baseUrl` and uses `moduleResolution: bundler` — import app files with relative paths, never `apps/...`. `tsconfck` (via `vite-tsconfig-paths`) has a TS 5-only optional peer, also forced via `overrides`.

### Local services & config

- Runtime secrets/config live in `apps/apex-client/env/env.ts` (and `env.dev.ts`): Gemini API key, Firebase config, Supabase URL/key. Imported directly as `env` in `app.config.ts`.
- **Supabase** is the primary datastore (objectives, tasks, conversations), expected locally at `http://127.0.0.1:54321`. SQL migrations are in `supabase/migrations/`; note the Postgres RPC `get_objective_subtree` used for recursive objective loading.
- **Firebase** (Firestore) persists XState workflow state only.

## Architecture

This is a **clean/hexagonal architecture**. The dependency rule is strict: domain and workflow code depend only on **abstractions** (abstract classes used as ports), and concrete infrastructure is injected at the composition root. `docs/features/send-message-to-ai-prd.md` and `docs/technical/*.md` are the authoritative design docs — read them before changing the AI workflow or layering.

### Three data representations (`docs/technical/data-flow.md`)

Data crosses three layers, each with its own shape, bridged by **mappers**:
- **Domain Model** (`libs/*/models/`) — rich classes with encapsulated state and business rules (e.g. `Objective`, `Task` extend `TodoBase`). The "working" state.
- **Persistence Data** (`libs/supabase/...mapper/`) — flat DB rows. `ObjectiveMapper.flatten` / `.toDomain` convert the objective tree ↔ rows.
- **Client ViewModel** (`apps/apex-client/src/chore/models/*.viewmodel.ts`) — UI-ready, mapped in `apps/apex-client/src/chore/mapper/`.

### Library layout

- **Domain libs** (`libs/objective`, `libs/chat`, `libs/auth`) contain **use cases** (`*.usecase.ts`, business logic, return `Result<T>`), **ports** (`protocols/*.repository.ts`, `protocols/*.provider.ts` — abstract classes), **models**, **queries/commands**, and **errors**. They have **no knowledge of each other, of the AI, or of any infrastructure.**
- **`libs/ai`** defines the generic generation capability (`AIProvider`, `InteractiveAIProvider` abstract classes) — knows nothing about chat/objectives.
- **`libs/gemini`** adapts the Google GenAI SDK to the `libs/ai` ports. Nothing outside the composition root may import it.
- **`libs/supabase` / `libs/firebase`** implement the domain repository/query ports against their SDKs.
- **`libs/chore`** is the shared kernel: `Result<T>` + `runWithResult`, `CoreError`, `IdGenerator`.
- **`libs/design-tokens`** is the design system shared by every productivity app: design tokens (`tokens.css`), the PrimeNG preset (`primeng-preset.ts`, `@org/design-tokens`) and layout utilities (`layout.css`). See the next section.

### Result & error handling

- Use cases return `Promise<Result<T>>` (a `{success:true,data}` | `{success:false,error}` union). Wrap the body in `runWithResult(action, [ExpectedError, ...], fallbackMessage)` — only the listed domain errors (subclasses of `CoreError`, which carry a stable `code`) become structured failures; anything else collapses to `UNKNOWN_ERROR`.
- **CQRS split** (`docs/technical/queries.md`): **query classes** (`*.query.ts`) only fetch and shape data — **no business logic and no error handling** (log and return an empty result on failure). If logic creeps in, make it a **use case** instead.

### The AI assistant workflow (`worklfows/ai-assistant`)

`SendMessageToAIWorkflow` is a **transversal application orchestrator** — it composes `chat`, `objective`, and `ai` but owns none of their concepts, and never touches Gemini/Firebase/Supabase directly (all injected as ports: `IChatActor`, `IAIActor`, `IToolExecutor`, `IToolExecutionPolicy`, `IToolRegistry`, `IWorkflowStateRepository`).

- The core is an **XState v5 machine** (`lib/workflow/machine.ts`): register user message → send prompt to AI → branch on `text` vs `toolCall` → run tools (each gated by a `ToolPolicy` that can require user permission) → feed results back → persist the AI response. Tools are registered in a `ToolRegistry` (e.g. `GetObjectiveTreeTool`).
- One actor exists **per objective id**. `startWorkFlow(id)` resumes a persisted machine (via `IWorkflowStateRepository` → Firebase) or starts fresh; every transition is persisted. There is no streaming — the client **polls `getState()` every second** (see `chat.store.ts`).

### Client state (NgRx Signals)

- State lives in **`signalStore`s** under `apps/apex-client/src/chore/stores/`, assembled from composable **`signalStoreFeature`s** named `with-*.ts` (e.g. `ObjectiveStore` composes `withObjectiveQuery`, `withCreateObjective`, `withTaskEisenhowerSeparate`, `withStats`, …).
- Async work uses `rxMethod` + `tapResponse`. **Optimistic updates** are the norm: insert a row with a temporary id (`withOptimistiqueId`), then reconcile or roll back on the use-case `Result` (see `features/with-create-objective.ts`). PrimeNG `MessageService` shows success/error toasts.
- `SessionStore` restores the session in an app initializer; routes are guarded by `authGuard` (`app.routes.ts`).

### Dependency injection = composition root

Everything is wired in **`apps/apex-client/src/chore/providers/*.ts`**, aggregated in `app.config.ts`. Ports (abstract classes) are bound to concrete implementations with `useFactory`/`deps` — this is the only place domain abstractions meet infrastructure. **When you add a use case, port, or adapter, wire it here.**

### Module boundaries

`eslint.config.mjs` configures `@nx/enforce-module-boundaries` with intended scopes (`scope:shared`, `scope:apex-client`, `scope:api`) and `type:data`. Only `apex-client` currently carries a tag (`scope:apex-client`); if you add tags to libs, respect those constraints.

## Front-end & design system (mandatory)

All productivity apps share one design system, `libs/design-tokens`. **Apps never contain custom CSS**: appearance comes from PrimeNG components themed by the shared preset, layout from the `.ds-*` classes.

- **Before any UI work** (page, component, template, layout, modal, form, responsive, dark mode, visual bug), follow the `frontend-ui` skill (`.claude/skills/frontend-ui/SKILL.md`) and read the sources it lists. Order of preference: PrimeNG component (catalogue in `.claude/skills/frontend-ui/references/catalogue-primeng.md`) → preset change → per-instance `[dt]` with `var(--ds-*)` tokens → `.ds-*` layout classes.
- **Forbidden in apps**: component stylesheets (`styleUrl`, `styleUrls`, `styles`, `.css`/`.scss` files), `style="…"`, `[ngStyle]`, `[ngClass]`, `::ng-deep`, `!important`, raw colors or lengths (`#hex`, `rgb()`, `'red'`, `px`, `rem`…), classes other than `ds-*` and `pi`/`pi-*`, invented tokens or classes, themes or `definePreset`.
- **Changing the design system itself** (tokens, PrimeNG preset, `[dt]` variants, `.ds-*` utilities, dark mode, contrast) follows the `design-system-evolution` skill (`.claude/skills/design-system-evolution/SKILL.md`): right token level, naming conventions, `CHANGELOG.md` entry and semver bump, user approval before any change to the visual identity.
- If a need cannot be met without custom CSS, stop and propose a design-system addition instead of working around it.
- `npx nx lint design-tokens` enforces these rules (and WCAG AA contrast in light and dark mode). It runs in CI through `run-many -t lint` and must pass before handing work back. Never weaken the check to make a change pass.
- A Claude Code hook (`.claude/settings.json` → `.claude/hooks/design-system-check.mjs`) runs the same check after every Edit/Write on `apps/**`, `libs/design-tokens/**` or `tools/design-system/**`, and once more at the end of a turn if front-end files changed. When it reports violations, fix them right away.

## Conventions

- File suffixes signal role: `*.usecase.ts`, `*.repository.ts`, `*.query.ts`, `*.command.ts`, `*.mapper.ts`, `*.provider.ts` (Angular DI providers), `*.store.ts`, `with-*.ts` (store features), `*.viewmodel.ts`, `*.error.ts`, `*.protocols.ts` / `protocols/*.ts` (ports).
- Angular uses standalone components with the modern flat naming (`chat.ts` / `chat.html` / `chat.store.ts`, not `*.component.ts`); PrimeNG themed by the shared `DesignSystemPreset` (built on Lara) from `@org/design-tokens`; TS path aliases are `@org/<lib>` (see `tsconfig.base.json`).
- `TODO.md` (root) and `libs/objective/src/lib/usecases/TODO.md` track the current backlog (French).
