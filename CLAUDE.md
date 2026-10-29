# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

Apex is a goal/objective-management app (objectives → stages/sub-objectives → steps/tasks, an Eisenhower matrix, and the Akari AI assistant). This repository is the **web client**: an **Nx 23 monorepo** with a single **Angular 22** app, `apex-client` (TypeScript 6). **The business rules, the data and Akari live in Apex Brain**, the server (repo `tiffan-source/apex-brain`, NestJS, hosted on Render at `https://apex-brain-kapj.onrender.com`): the client displays and calls its REST API. The contract is `docs/api.md` in apex-brain, and `/docs` (Swagger UI) or `/docs-json` on the server. The codebase is written in English, but **docs, code comments, UI strings, and commit messages are in French** — match that when editing those.

## Commands

`package.json` has no scripts; everything runs through Nx. Prefix with `npx` (no global install).

| Task | Command |
|------|---------|
| Serve the app (dev) | `npx nx serve apex-client` |
| Build | `npx nx build apex-client` |
| Unit tests | `npx nx vite:test apex-client` |
| Single test file | `npx nx vite:test apex-client -- src/app/path/to/file.spec.ts` |
| Lint | `npx nx lint apex-client` |
| Typecheck | `npx nx typecheck apex-client` |
| Only what changed | `npx nx affected -t vite:test lint typecheck` |

- The unit test target is `vite:test` (not `test`). Tests are **Vitest + jsdom** via `@analogjs/vite-plugin-angular`; `.spec.ts` files are colocated with sources. E2E is Playwright (`e2e` target) when a project has a Playwright config.
- `npx nx serve apex-client` calls Apex Brain at `http://localhost:3000` (`src/environments/environment.development.ts`): start the API from its repo (`npx nx serve api`, with its own `.env`, whose `CORS_ORIGINS` allows `http://localhost:4200`). To work against the hosted API, serve the production configuration (`npx nx serve apex-client --configuration=production`); its origin must then be in the hosted API's `CORS_ORIGINS`. The free Render instance sleeps when idle: the first request after a pause can take about a minute.
- **Node ^22.22.3, ^24.15 or ≥ 26 is required** (Angular 22; Node 25 is not supported). `.nvmrc` pins Node 24.22.0: run `nvm use` first; the system Node in `/usr/local/bin` (24.8) is too old.
- **The UI library is Empreinte** (`@empreinte-studio/angular` + `@empreinte-studio/tokens`, versioned together), published on **GitHub Packages**: `.npmrc` maps the `@empreinte-studio` scope to `npm.pkg.github.com` and reads `NODE_AUTH_TOKEN`, so `npm install` needs a GitHub token with `read:packages` exported as `NODE_AUTH_TOKEN`. Its peers `@angular/aria` and `@angular/cdk` follow Angular's version — align them with `nx migrate`, not by hand. PrimeNG is uninstalled (migration, `docs/features/migration-empreinte.md`): never bring it back.
- TypeScript 6: `tsconfig.base.json` has no `baseUrl` and uses `moduleResolution: bundler` — import app files with relative paths, never `apps/...`. `tsconfck` (via `vite-tsconfig-paths`) has a TS 5-only optional peer, forced via `overrides` in `package.json`.

### Configuration

- `apps/apex-client/src/environments/environment.ts` (production: the hosted API) and `environment.development.ts` (swapped in by `fileReplacements` for the development configuration) hold **only the API's URL**. No secret lives in the client: the Supabase, Gemini and Firebase keys are the server's.
- The deployed client is served by **Firebase Hosting** (`firebase.json`, `.firebaserc`, from `dist/apps/apex-client/browser`); its origin must be in the API's `CORS_ORIGINS` (Render environment).
- The database schema (Supabase migrations) and Akari's workflow are in apex-brain. `apps/apex-client/env/env.ts` and `supabase/functions/.env` are obsolete local files, kept in `.gitignore` so a leftover copy is never committed.

## Architecture

The client does **no business operation**: no use case, repository, domain model, nor Supabase, Firebase or Gemini SDK. It sends the person's gestures to the API and renders what the API returns. The few rules the API does not expose yet are listed in `docs/technical/data-flow.md` (« Rules still in the client ») — do not add new ones: add an endpoint to apex-brain instead.

### Calling the API (`apps/apex-client/src/chore/api/`)

- `api.models.ts` holds the HTTP contract (bodies and responses, dates in ISO 8601). `ObjectivesApi` (`objectives.api.ts`: objectives, stages, steps), `AssistantApi` (`assistant.api.ts`: a root objective's conversation and Akari's workflow) and `AuthApi` (`auth.api.ts`): one method per route, returning a `Promise` (the stores chain their writes on promises).
- Every failure becomes an **`ApiError`** (`api-error.ts`) read from the API's error body `{ error: { code, message, details? } }`. The **code** is the contract (`OBJECTIVE_NOT_FOUND`, `VALIDATION_ERROR`, `WORKFLOW_BUSY`…, and `NETWORK_ERROR` when the server did not answer); screens pick one French sentence per code (`failureReport`, `translateAuthError`, `sendFailureReport`) — **never display `message`** (technical, in English).
- `ApiSession` (`api-session.ts`) keeps the session — `{ user, session: { accessToken, refreshToken, expiresAt } }` — in `localStorage` (`apex:session`), shared between tabs. `authInterceptor` adds `Authorization: Bearer` to requests to the API only (never to another host, nor to `/v1/auth/login|register|refresh`), refreshes the token shortly before it expires or on a 401 (one refresh at a time, then a single retry). A refused refresh closes the session and `provideSessionEndRedirect` sends the person to `/auth`; a network failure keeps it.
- The owner is never sent: the API derives the person from the token. `provideApi(environment.apiUrl)` (`chore/providers/api.provider.ts`) wires `HttpClient` (fetch) and the interceptor.

### Two data representations (`docs/technical/data-flow.md`)

- **HTTP contract** (`chore/api/api.models.ts`) — what the API sends and receives.
- **Client ViewModel** (`apps/apex-client/src/chore/models/*.viewmodel.ts`) — UI-ready, mapped in `apps/apex-client/src/chore/mapper/` (`objective.mapper.ts` turns `GET /v1/objectives` into the store state).

### Client state (NgRx Signals)

- State lives in **`signalStore`s** under `apps/apex-client/src/chore/stores/`, assembled from composable **`signalStoreFeature`s** named `with-*.ts` (e.g. `ObjectiveStore` composes `withObjectiveQuery`, `withObjectivesLoaded`, `withCreateObjective`, `withObjectiveViews`, `withMoveTaskToQuadrant`, …), which call `ObjectivesApi`. `signalStore()` has typed overloads for at most 15 features: past that, group features in one `signalStoreFeature`.
- Async work uses `rxMethod` + `tapResponse`. **Optimistic updates** are the norm: insert a row with a temporary id (`withOptimistiqueId`), then swap in the id the API returns, or roll back on an `ApiError` (see `features/with-create-objective.ts`). Writes and the objectives load go one at a time through `WriteQueue` (`stores/utils/write-queue.ts`) — the server's use cases read then rewrite a whole objective tree, two concurrent writes could overwrite each other; a load keeps the optimistic rows still in flight (`keepOptimistic`), and a reload that a gesture overtook is discarded and read again (`WriteQueue.enqueued`), so it never erases that gesture from the screen. Gestures pass `whenSignedIn` (no session, nothing is sent). `requestStatus` is shared by every action: before showing an empty state or « introuvable », screens read `objectivesLoaded()`. Outcomes go through **`AnnoncesStore`** (`chore/stores/annonces.store.ts`, provided in root): `annoncer(text)` for a success (screen-reader announcement via the CDK `LiveAnnouncer`, nothing shown), `signaler(text)` for a failure (an Akari note shown in the page by the shell). No toasts; one French sentence per error code, with the fix (migration doc § 6-7).
- `SessionStore` derives the signed-in person from `ApiSession` (restored from the browser at start-up, without waiting for the server), signs in and creates accounts through `AuthApi`, and keeps the API's error code in `error()` for the sign-in screen. Routes are guarded by `authGuard` (`app.routes.ts`).

### Akari

The workflow (XState machine, Gemini, tools) runs **in the server**, one per root objective; there is no streaming. `ChatStore` (`app/objective/akari/chat.store.ts`, provided by the Akari screen) loads the conversation (`GET …/conversation`), sends a message (`POST …/assistant/messages`, 202) or the answer to a permission request (`POST …/assistant/permission` with the `toolCallId`), then **polls `GET …/assistant` every second** while `status` is `processing` — it stops at `ready` or `awaiting-permission`. `value` picks the status line, `lastError` (a turn stopped by a server-side failure) is reported. After the person accepts a write tool (a stage, a step), `AkariWritesStore` (`chore/stores/akari-writes.store.ts`, provided by the shell next to `ObjectiveStore`) waits for the tool to run and reloads the objectives, even if the Akari screen is gone.

### Dependency injection

`app.config.ts` gathers the providers: Empreinte, the router, `A11yProviders`, `provideApi(environment.apiUrl)` and `provideSessionEndRedirect()` (`chore/providers/*.ts`). The API services are `providedIn: 'root'`; tests replace them (`{ provide: ObjectivesApi, useValue: … }`) or exercise them with `provideHttpClientTesting()`.

### Module boundaries

`eslint.config.mjs` configures `@nx/enforce-module-boundaries` with intended scopes (`scope:shared`, `scope:apex-client`, `scope:api`) and `type:data`. `apex-client` is the only project (`scope:apex-client`).

## Front-end & design system

Apex's UI is built on the **Empreinte** design system, which supplies the identity shared by every app of the suite: Jour/Nuit color tokens, spacing (`--pas-*`), the 8 typographic classes (`manifeste`, `objectif`, `voix`, `palier`, `section`, `corps`, `detail`, `repere`) and the components of `@empreinte-studio/angular` (which ship their own stylesheets). **Apex owns its layout and screen styling**: the shell, where the navigation sits, page widths, breakpoints and each screen's composition live in this repo, next to the components, and can change whenever Apex does.

- **Where styles go**: a style that belongs to one screen goes in that component's stylesheet (`<name>.css` next to the template, referenced by `styleUrl`; emulated encapsulation, short role-named classes without prefix). A composition shared by two screens can have its own stylesheet listed by both. Generic utilities shared by several screens live in `apps/apex-client/src/styles/layout.css` (`.ds-*`: page, stacks, rows, gaps, the panel grid, a few modifiers, plus the shared `--ds-*` layout values), loaded after Empreinte by `apps/apex-client/project.json`; move a class there only once a second screen needs it. Akari's conversation is Empreinte's `e-conversation` (thread, replies, prose of the rendered Markdown, status line, composer, scrolling that opens on the latest replies): Apex maps its messages to `Replique`s and only sets the host's height and inset (`objective/akari/akari.css`). Above 1100px the Akari page fits the window: its route carries `data: { fitsWindow: true }`, so the shell (`shell.css`, class `fits-window`) hands the window height to the page through `.outlet`, and every level down to the conversation keeps `min-height: 0`; below 1100px the page scrolls down to the conversation's foot once its history is loaded (`akari.ts`). The new objective uses the thread alone (`ol[eFil]` > `li[eReplique]`).
- **Values**: colors always through Empreinte tokens (`var(--encre-douce)`, `var(--trame)`…) so Jour/Nuit follow; spacing and rules through tokens when one exists (`var(--pas-4)`, `var(--trait-fin)`, `--ds-space-*` for in-between steps). Apex's breakpoints: 760px (mobile), 900px, 1100px.
- **What goes upstream to Empreinte** (repo `empreinte-studio/empreinte`: Conventional Commits, GitHub Packages release, then a `@empreinte-studio/*` bump here): only what any app of the suite would reuse — a missing or broken component, a variant, an icon, a token, a voice helper. Apex's page and app layout never goes there. Placing, sizing or spacing an Empreinte component from Apex's CSS is fine; changing its look (color, shape, type) affects the identity and belongs upstream if it is meant for the whole suite.
- **The PrimeNG → Empreinte migration** (branch `feat/rebrand-empreinte`) is specified in `docs/features/migration-empreinte.md`: V1 scope and routes, UI vocabulary (objectif, étape, pas, arête, laisser filer), Akari as a gesture, voice, `AnnoncesStore`, theme, per-screen checklist. It is authoritative for UI work. PrimeNG is gone: no `<p-*>`, `pButton`, `[dt]`, `pi pi-*`, `providePrimeNG` or `MessageService`.
- **Before any UI work** (screen, component, template, stylesheet, layout, sheet/dialog, form, responsive, Jour/Nuit theme, UI copy, visual bug), follow the `frontend-ui` skill (`.claude/skills/frontend-ui/SKILL.md`) and read the sources it lists: the migration doc, the component catalogue `.claude/skills/frontend-ui/references/catalogue-empreinte.md` (exact API of the installed version) and the screen's mockup. Order of preference: Empreinte component configured through its inputs → hand-written `e-*` kit class where the catalogue allows it → typographic classes for text → Apex CSS (a shared `.ds-*` utility, or the component's stylesheet) for layout.
- **Theme**: `provideEmpreinte({ theme: 'jour' })` in `app.config.ts` plus the theme script in `index.html`; Nuit is applied through `data-theme`, never through `prefers-color-scheme`.
- **Brand and voice**: one seal (`sceau`) per screen, one corner (`corne`) per group with `aria-current`, the four lights never for a state, no error in red; UI copy in French with *tu*, short sentences, never « échec », « erreur », « en retard », « supprimer », percentages, exclamation marks or emoji — use the voice helpers (`legendeProgression`, `formaterAttente`, `compter`…). `apps/apex-client/src/app/voice.spec.ts` runs every template text, readable attribute, component string and route title through `motsAEviter()` and `voiceIssues()`.

## Conventions

- File suffixes signal role: `*.api.ts` (the HTTP client of one API context), `*.mapper.ts`, `*.provider.ts` (Angular DI providers), `*.store.ts`, `with-*.ts` (store features), `*.viewmodel.ts`, `*.form.ts`, `*.constante.ts`.
- Angular uses standalone components with the modern flat naming (`akari.ts` / `akari.html` / `chat.store.ts`, not `*.component.ts`); UI components come from `@empreinte-studio/angular` (standalone, signal-based, with a French API: `eBouton="sceau"`, `[(fait)]`, `marquee`…).
- `TODO.md` (root) tracks the current backlog (French); the server's is `docs/plan.md` in apex-brain.
