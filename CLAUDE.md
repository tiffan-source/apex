# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

Apex is a goal/objective-management app (objectives → sub-objectives → tasks, an Eisenhower matrix, a daily focus, and an AI assistant). It is an **Nx 23 monorepo** with an **Angular 21** client, domain/infrastructure libraries, and an **XState** workflow package. The codebase is written in English, but **docs, code comments, UI strings, and commit messages are in French** — match that when editing those.

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

- The unit test target is `vite:test` (not `test`). Tests are **Vitest + jsdom** via `@analogjs/vite-plugin-angular`; `.spec.ts` files are colocated with sources. E2E is Playwright (`e2e` target) when a project has a Playwright config.
- Project names: `apex-client`, `objective`, `chat`, `ai`, `gemini`, `supabase`, `firebase`, `chore`, `auth`, `ai-assistant`, `apex-library`.
- **The workflow package lives under the misspelled directory `worklfows/` — use that exact path.**
- `nx serve apex-client` declares `dependsOn: ["api:serve"]`, but **no `api` project exists** (stale config, also referenced in `nx.json` `release` and `.vscode/launch.json`). If serve fails on a missing `api` dependency, that is why.

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

## Conventions

- File suffixes signal role: `*.usecase.ts`, `*.repository.ts`, `*.query.ts`, `*.command.ts`, `*.mapper.ts`, `*.provider.ts` (Angular DI providers), `*.store.ts`, `with-*.ts` (store features), `*.viewmodel.ts`, `*.error.ts`, `*.protocols.ts` / `protocols/*.ts` (ports).
- Angular uses standalone components with the modern flat naming (`chat.ts` / `chat.html` / `chat.store.ts`, not `*.component.ts`); PrimeNG with the Lara theme; TS path aliases are `@org/<lib>` (see `tsconfig.base.json`).
- `TODO.md` (root) and `libs/objective/src/lib/usecases/TODO.md` track the current backlog (French).
