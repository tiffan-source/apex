DATA FLOW
=========

During its lifecycle, data exists in four different representations: the domain and persistence layers, which live in the server (Apex Brain), the HTTP contract the server and its clients exchange, and the client layer.

Domain Layer
------------

The domain layer contains the business logic of the application. It is mainly composed of use cases and entities.

A use case should not exist because a client needs an action for a specific screen. It should exist because it represents a meaningful capability of the application.

The domain layer should describe useful actions and processes that help users achieve their goals, independently of any user interface.

For example:

-   `GetAllObjectives` only exposes stored data.
-   `GetImportantObjectivesForToday` represents a business intention because it applies rules to determine which objectives need attention.

This is where data is in its **awake / working** state.


Persistence Layer
-----------------

The persistence layer is responsible for storing and retrieving data.

Repositories are the bridge between the domain and the storage. The domain should not know how data is stored or retrieved.

The persistence layer contains data in its **sleep** state.


Client Layer
------------

The client layer is responsible for presenting domain capabilities to the user.

It is a separate application built on top of the domain layer. It has its own constraints, such as performance, user experience, and rendering.

The client does not directly use domain data. It uses a representation adapted for the user interface: the **View Model**.

The client layer contains data in its **ready to be displayed** state.


Data Representation
-------------------

Example: defining a new objective.

```mermaid
flowchart LR

A[User Action]
B[Objective Model<br/>Domain]
C[Objective Data<br/>Persistence]
E[Objective Output<br/>HTTP contract]
D[Objective ViewModel<br/>Client]

A --> E
E --> B
B --> C
B --> E
E --> D
```

The domain and persistence layers live in the server. Between the server and the clients, data travels in a fourth shape: the **HTTP contract** (the request and response schemas of the API, documented in `docs/api.md` of apex-brain). The clients build their View Models from it.


Applications
------------

There are currently three software systems:

-   `apex-brain` (repository `tiffan-source/apex-brain`): the server. It holds the domain and persistence layers — the core business logic, Supabase, Gemini, Firebase and Akari's workflow — and exposes the capabilities over a REST API.
-   `apex-client` (this repository): the web application used by the person.
-   the mobile application (React Native, Expo).

The clients are complete applications with their own architecture and data flow. They only consume the capabilities exposed by the API. In the web client:

-   `apps/apex-client/src/chore/api/` calls the API: `api.models.ts` describes the HTTP contract, one service per context (`ObjectivesApi`, `AssistantApi`, `AuthApi`) calls its routes, and every failure becomes an `ApiError` carrying the API's error code;
-   the stores (`chore/stores/`) send the person's gestures through these services, optimistically;
-   the mappers (`chore/mapper/`) turn the HTTP contract into View Models.


What the client does not compute
--------------------------------

The web client holds no business rule. It does not decide whether a stage is done, whether an objective is « accomplished », nor in which Eisenhower quadrant a step falls. These are Apex Brain's rules (the decisions are written in `docs/features/migration-empreinte.md`, § 4), shared with the mobile application.

Whether a stage or an objective is done, the API says so (`done` in `GET /v1/objectives`), the client displays it and counts it, and reads the objectives again after a write that can change it (`loadObjectives`, after checking, adding or moving a step). That re-read keeps trying while the failure is transient: the shell's note comes with the fourth retry and goes as soon as the server answers. The words « étape accomplie » follow `done` too, never the count of steps. Stages and steps have no order: they are independent, the client numbers none and picks none.

The API does not return the quadrant of a step yet, so the screens do not show it (removed from the client on 2 November 2026): the matrix screen is withdrawn (`/matrice`, `/matrix` and `/focus` lead home). When it returns, a step does not move from it: it changes quadrant when its importance or urgency is edited on its objective.

To bring it back, the API returns it first — a computed field in `GET /v1/objectives` — then the client maps and displays it. Never compute it in the client.

What stays in the client is presentation and form values, not rules: the names of the five importance and urgency levels (`IMPORTANCE_OPTIONS`, `URGENCY_OPTIONS`) and the levels pre-selected in the « Ajouter un pas » sheet (`NEW_TASK_LEVELS`, which the person changes), all in `chore/constants/task.constante.ts`. The client sends the levels; which quadrant they put a step in is the API's answer.
