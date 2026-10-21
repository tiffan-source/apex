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
- **The UI library is Empreinte** (`@empreinte-studio/angular` + `@empreinte-studio/tokens`, versioned together), published on **GitHub Packages**: `.npmrc` maps the `@empreinte-studio` scope to `npm.pkg.github.com` and reads `NODE_AUTH_TOKEN`, so `npm install` needs a GitHub token with `read:packages` exported as `NODE_AUTH_TOKEN`. Its peers `@angular/aria` and `@angular/cdk` follow Angular's version — align them with `nx migrate`, not by hand. PrimeNG is uninstalled (migration, `docs/features/migration-empreinte.md`): never bring it back.
- TypeScript 6: `tsconfig.base.json` has no `baseUrl` and uses `moduleResolution: bundler` — import app files with relative paths, never `apps/...`. `tsconfck` (via `vite-tsconfig-paths`) has a TS 5-only optional peer, forced via `overrides` in `package.json`.

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
- **`libs/design-tokens`** (`@org/design-tokens`) is Apex's **layout layer on top of Empreinte**: layout tokens `--ds-*` (`tokens.css`: breakpoints, widths, panel padding — no colors), `.ds-*` layout classes (`layout.css`) and `DS_BREAKPOINTS` / `DS_MEDIA` for `BreakpointObserver` (`index.ts`). The visual identity itself (Jour/Nuit colors, typography, components) comes from Empreinte. See the front-end section.

### Result & error handling

- Use cases return `Promise<Result<T>>` (a `{success:true,data}` | `{success:false,error}` union). Wrap the body in `runWithResult(action, [ExpectedError, ...], fallbackMessage)` — only the listed domain errors (subclasses of `CoreError`, which carry a stable `code`) become structured failures; anything else collapses to `UNKNOWN_ERROR`.
- **CQRS split** (`docs/technical/queries.md`): **query classes** (`*.query.ts`) only fetch and shape data — **no business logic and no error handling** (log and return an empty result on failure). If logic creeps in, make it a **use case** instead.

### The AI assistant workflow (`worklfows/ai-assistant`)

`SendMessageToAIWorkflow` is a **transversal application orchestrator** — it composes `chat`, `objective`, and `ai` but owns none of their concepts, and never touches Gemini/Firebase/Supabase directly (all injected as ports: `IChatActor`, `IAIActor`, `IToolExecutor`, `IToolExecutionPolicy`, `IToolRegistry`, `IWorkflowStateRepository`).

- The core is an **XState v5 machine** (`lib/workflow/machine.ts`): register user message → send prompt to AI → branch on `text` vs `toolCall` → run tools (each gated by a `ToolPolicy` that can require user permission) → feed results back → persist the AI response. Tools are registered in a `ToolRegistry` (e.g. `GetObjectiveTreeTool`).
- One actor exists **per objective id**. `startWorkFlow(id)` resumes a persisted machine (via `IWorkflowStateRepository` → Firebase) or starts fresh; every transition is persisted. There is no streaming — the client **polls `getState()` every second** (see `apps/apex-client/src/app/objective/akari/chat.store.ts`). After the person accepts a write tool (a stage, a step), `AkariWritesStore` (`chore/stores/akari-writes.store.ts`, provided by the shell next to `ObjectiveStore`) reloads the objectives as soon as the tool has run, even if the Akari screen is gone.

### Client state (NgRx Signals)

- State lives in **`signalStore`s** under `apps/apex-client/src/chore/stores/`, assembled from composable **`signalStoreFeature`s** named `with-*.ts` (e.g. `ObjectiveStore` composes `withObjectiveQuery`, `withObjectivesLoaded`, `withCreateObjective`, `withObjectiveViews`, `withMoveTaskToQuadrant`, …). `signalStore()` has typed overloads for at most 15 features: past that, group features in one `signalStoreFeature`.
- Async work uses `rxMethod` + `tapResponse`. **Optimistic updates** are the norm: insert a row with a temporary id (`withOptimistiqueId`), then reconcile or roll back on the use-case `Result` (see `features/with-create-objective.ts`). Writes and the objectives load go one at a time through `WriteQueue` (`stores/utils/write-queue.ts`); a load keeps the optimistic rows still in flight (`keepOptimistic`), and a reload that a gesture overtook is discarded and read again (`WriteQueue.enqueued`), so it never erases that gesture from the screen. `requestStatus` is shared by every action: before showing an empty state or « introuvable », screens read `objectivesLoaded()`. Outcomes go through **`AnnoncesStore`** (`chore/stores/annonces.store.ts`, provided in root): `annoncer(text)` for a success (screen-reader announcement via the CDK `LiveAnnouncer`, nothing shown), `signaler(text)` for a failure (an Akari note shown in the page by the shell). No toasts; never display a domain `error.message` — write one French sentence per error code, with the fix (migration doc § 6-7).
- `SessionStore` restores the session in an app initializer; routes are guarded by `authGuard` (`app.routes.ts`).

### Dependency injection = composition root

Everything is wired in **`apps/apex-client/src/chore/providers/*.ts`**, aggregated in `app.config.ts`. Ports (abstract classes) are bound to concrete implementations with `useFactory`/`deps` — this is the only place domain abstractions meet infrastructure. **When you add a use case, port, or adapter, wire it here.**

### Module boundaries

`eslint.config.mjs` configures `@nx/enforce-module-boundaries` with intended scopes (`scope:shared`, `scope:apex-client`, `scope:api`) and `type:data`. Only `apex-client` currently carries a tag (`scope:apex-client`); if you add tags to libs, respect those constraints.

## Front-end & design system (mandatory)

Apex's UI is built on the **Empreinte** design system. **Apps never contain CSS**: appearance comes from Empreinte components (`@empreinte-studio/angular`, which ship their own stylesheets), text from Empreinte's 8 typographic classes (`manifeste`, `objectif`, `voix`, `palier`, `section`, `corps`, `detail`, `repere`), layout from the `.ds-*` classes of `libs/design-tokens`.

- **The PrimeNG → Empreinte migration** (branch `feat/rebrand-empreinte`) is specified in `docs/features/migration-empreinte.md`: V1 scope and routes, UI vocabulary (objectif, étape, pas, arête, laisser filer), Akari as a gesture, voice, `AnnoncesStore`, theme, per-screen checklist. It is authoritative for UI work.
- **Before any UI work** (screen, component, template, layout, sheet/dialog, form, responsive, Jour/Nuit theme, UI copy, visual bug), follow the `frontend-ui` skill (`.claude/skills/frontend-ui/SKILL.md`) and read the sources it lists: the migration doc, the component catalogue `.claude/skills/frontend-ui/references/catalogue-empreinte.md` (exact API of the installed version), `layout.css`, and the screen's mockup. Order of preference: Empreinte component configured through its inputs → hand-written `e-*` kit class only where the catalogue allows it → typographic + `.ds-*` classes → nothing fits: stop and propose an evolution.
- **Forbidden in apps**: stylesheets (`styles`, `styleUrl(s)`, `.css`/`.scss` files other than `src/styles.css`, which only `@import`s Empreinte), `style="…"`, `[style.x]`, `[ngStyle]`, `[ngClass]`, `[class]`, `class="{{…}}"` (toggle with `[class.ds-x]`), `::ng-deep`, `!important`, styling from code, raw colors or lengths (`#hex`, `rgb()`, `'red'`, `px`, `rem`, media-query strings — use `DS_MEDIA`), classes other than `.ds-*`, Empreinte's shipped `e-*` and the 8 typographic ones, unknown tokens, and any PrimeNG trace (`<p-*>`, `pButton`, `[dt]`, `pi pi-*`, `providePrimeNG`, `MessageService`).
- **Theme**: `provideEmpreinte({ theme: 'jour' })` in `app.config.ts` plus the theme script in `index.html`; Nuit is applied through `data-theme`, never through `prefers-color-scheme`.
- **Brand and voice**: one seal (`sceau`) per screen, one corner (`corne`) per group with `aria-current`, the four lights never for a state, no error in red; UI copy in French with *tu*, short sentences, never « échec », « erreur », « en retard », « supprimer », percentages, exclamation marks or emoji — use the voice helpers (`legendeProgression`, `formaterAttente`, `compter`…). `apps/apex-client/src/app/voice.spec.ts` runs every template text, readable attribute, component string and route title through `motsAEviter()` and `voiceIssues()`.
- **Changing the design system** follows the `design-system-evolution` skill (`.claude/skills/design-system-evolution/SKILL.md`), at two levels: **Empreinte** (identity, components, kit, tokens, contrast, Nuit) changes upstream in the `empreinte-studio/empreinte` repo (Conventional Commits, GitHub Packages release, then a `@empreinte-studio/*` bump here) — never overridden locally; **Apex's layout layer** (`libs/design-tokens`) follows naming rules, a `CHANGELOG.md` entry and semver bump, and user approval before any change to the visual identity.
- If a need cannot be met without custom CSS, stop and propose a design-system addition instead of working around it.
- `npx nx lint design-tokens` (`tools/design-system/check.mjs`) enforces these rules, the layout layer's rules and the WCAG contrast pairs promised by Empreinte's brand book in Jour and Nuit. It runs in CI through `run-many -t lint` and must pass before handing work back. Never weaken the check to make a change pass.
- A Claude Code hook (`.claude/settings.json` → `.claude/hooks/design-system-check.mjs`) runs the same check after every Edit/Write on `apps/**`, `libs/design-tokens/**` or `tools/design-system/**`, and once more at the end of a turn if front-end files changed. When it reports violations in files you touched, fix them right away; report the others instead of fixing someone else's files.

## Conventions

- File suffixes signal role: `*.usecase.ts`, `*.repository.ts`, `*.query.ts`, `*.command.ts`, `*.mapper.ts`, `*.provider.ts` (Angular DI providers), `*.store.ts`, `with-*.ts` (store features), `*.viewmodel.ts`, `*.error.ts`, `*.protocols.ts` / `protocols/*.ts` (ports).
- Angular uses standalone components with the modern flat naming (`akari.ts` / `akari.html` / `chat.store.ts`, not `*.component.ts`); UI components come from `@empreinte-studio/angular` (standalone, signal-based, with a French API: `eBouton="sceau"`, `[(fait)]`, `marquee`…); TS path aliases are `@org/<lib>` (see `tsconfig.base.json`).
- `TODO.md` (root) and `libs/objective/src/lib/usecases/TODO.md` track the current backlog (French).
