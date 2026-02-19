# Datasheet Validator

A monorepo SDK for uploading, reviewing, and correcting structured JSON data before it enters a system. Ships a framework-agnostic core package and a Vite-based demo app.

Built to address two interrelated concerns: keeping the review table **fast and usable with large datasets** — through virtualization, stable references, and targeted re-renders — and exposing the core logic as a **clean, framework-agnostic SDK** that can be loaded, queried, edited, and observed independently of any UI layer. React is a thin integration layer on top, not the source of truth.

For performance sake and good UX  frontend uses table row virtualization, columns sorting option, separate list of errors in the data with option to immediately edit/fix table cells.

Custom validation rules (`required`, `min`, `max`, `pattern`, `min-length`, `max-length`) and custom error messages can be passed using `DataStoreOptions` or added at any point with `store.addValidationRules()`, which triggers an immediate full re-validation.

The validation module has separate methods for initialization of the store along with separate methods to parse, validate data.

## Packages


| Package                              | Description                                                         |
| ------------------------------------ | ------------------------------------------------------------------- |
| @data-validator/validator-mastermind | Framework-agnostic core SDK — parsing, validation, state management |
| frontend (React)                     | Vite + React 19 demo app consuming the SDK                          |


## Prerequisites

- [Node.js](https://nodejs.org/) 18+
- [pnpm](https://pnpm.io/) 9+

## Getting started

```bash
# Install dependencies
pnpm install

# Start the demo app (http://localhost:5173)
pnpm --filter frontend dev
```

The demo app auto-loads `test-data.json` on startup so you see data immediately without uploading a file.

## What it does

1. **Upload** — drag-and-drop or browse for a `.json` file (up to 5 MB)
2. **Review** — inspect the parsed data in a sortable, virtualized table with auto-inferred column types
3. **Correct** — edit cells inline; errors are flagged non-blockingly with tooltips
4. **Export** — call `store.exportData()` to get the cleaned data back as plain objects

---

## Focus areas

### SDK & API design quality (primary)

The core package (`@data-validator/validator-mastermind`) is designed as a reusable, framework-agnostic SDK with zero runtime dependencies.

**What's implemented:**

- **Clear public API surface** — `DataStore` exposes explicit, named methods for every operation: load, read state, edit cells, subscribe to changes, export data.
- **Framework-agnostic state model** — `subscribe()` + `getSnapshot()` works with React's `useSyncExternalStore (React 18+),` vanilla JS or any other subscriber. React here is only for rendering  and own no data state.
- **DataStore state types** — `DataStoreState` is `{ status: 'idle' } | { status: 'loading' } | { status: 'loaded'; data: DataSet } | { status: 'error'; error: DataValidatorError }`. Exhaustive handling enforced by TypeScript; no null checks or magic strings needed.
- **Custom error class hierarchy** — All errors extend `DataValidatorError` and carry a `.code: string` for programmatic handling (`ParseError`, `FileSizeError`, `ValidationFailedError`). Raw strings are never thrown.
- **Standalone  method exports** — `parse()`, `validateCell()`, `validateRow()`, `validateAllRows()` can be used without a `DataStore`, e.g. in a Node.js pipeline or server-side step.
- **Dual ESM + CJS output** with TypeScript declarations — consumers can use the package in any module system with full type safety.
- **Testability** — core has no DOM or React dependency; every method can be exercised with plain Vitest / `node:test` without jsdom.
- **Batch edits** — `batchUpdateCells()` applies multiple edits in one state notification, avoiding unnecessary re-renders for bulk operations.

### Performance & large datasets (secondary)

The review table stays responsive regardless of dataset size.

**What's implemented:**

- **Row virtualization** — `@tanstack/react-virtual` renders only the rows in the viewport plus a 10-row overscan. This makes DOM node count stays constant as dataset size grows and removes the need of using pagination.
- **Stable row references on edit** — `updateCell()` produces a new object only for the edited row and the rows array. All other rows keep their previous reference, so `React.memo`-wrapped cells skip re-rendering entirely.
- `**EditableCell` memoized** — wrapped in `React.memo`; an edit to one cell does not cause sibling cells or other rows to re-render.
- **Column sorting in the row model** — TanStack Table applies sorting before virtualization; re-ordering does not remount the virtualizer.

---

## Using the core SDK

```typescript
import { DataStore, ValidationRuleTypes } from "@data-validator/validator-mastermind";

const store = new DataStore({
  validationRules: {
    age: [{ type: ValidationRuleTypes.MIN, value: 0 }],
  },
});

store.subscribe(() => console.log(store.getState()));

store.loadFromString(JSON.stringify([
  { name: "Alice", age: 30 },
  { name: "Bob", age: -1 },
]));

console.log(store.getErrorCount());   // 1
console.log(store.exportData());      // plain objects
```

See [packages/validator-mastermind/README.md](packages/validator-mastermind/README.md) for the full API reference.

---

## Architecture decisions

### ADR-001 — Framework-agnostic core with event-based state

**Background.** The project was defined from the start with a hard requirement: **framework-agnostic core package** (Vanilla JS / TypeScript). The React package should primarily act as an adapter — the **core package must contain the main logic** and be reusable without React.

The decision was a subscription-based external store: a plain `DataStore` class that owns all state and notifies registered listeners whenever something changes.

**How it works.** `DataStore` exposes three surface areas:

*Mutations* — methods that change state and trigger notifications:

```typescript
store.loadFromString(json, fileName?)   // parse + validate, sets status → 'loaded' | 'error'
store.loadFromFile(file)                // async wrapper around loadFromString
store.updateCell(rowId, columnKey, value) // edit one cell, re-validates that row
store.batchUpdateCells(edits[])         // multiple edits, single notification
store.addValidationRules(columnKey, rules) // add rules, triggers full re-validation
store.reset()                           // returns to idle, clears all data
```

*Reads* — synchronous, always return the current state without side effects:

```typescript
store.getSnapshot()         // full DataStoreState discriminated union
store.getData()             // DataSet | null
store.getRows()             // Row[]
store.getColumns()          // Column[]
store.getRow(rowId)         // Row | undefined
store.getCellValue(rowId, columnKey) // CellValue | undefined
store.getErrorCount()       // total number of cell-level validation errors
store.getRowsWithErrors()   // only rows that have ≥ 1 error
store.exportData()          // plain objects stripped of error metadata
```

*Subscription* — wire any observer to state changes:

```typescript
const unsubscribe = store.subscribe(() => {
  // called after every mutation
  console.log(store.getSnapshot())
})
```

In React, the built-in `useSyncExternalStore` hook (React 18+) consumes exactly these two methods:

```tsx
const state = useSyncExternalStore(store.subscribe, store.getSnapshot)
```

That one line is the entire React integration. There is no Context provider, no reducer, no library beyond what ships with React itself. When `state.status === 'loaded'`, `state.data` is the full `DataSet` — TypeScript enforces exhaustive handling of all status variants (`idle`, `loading`, `loaded`, `error`), so there are no null checks or magic strings in the UI layer.

The state machine follows a strict path: `idle → loading → loaded | error`. Calling `reset()` always returns to `idle`. Each transition replaces the entire state object, so React can detect changes with a simple reference equality check.

**What was considered and rejected:**

- *React Context only* — no setup friction for React consumers, but it would have broken the zero-framework-dependency requirement entirely. Node.js and non-React consumers would be cut off.
- *Redux-style actions and reducers* — well-understood pattern with excellent devtools. Rejected because it is heavyweight for a focused SDK and forces consumers to learn Redux's action-creator and reducer conventions even in projects that use neither.
- *Zustand or Jotai* — lighter than Redux but still framework-adjacent libraries. Any runtime dependency in the core would contradict the portability requirement.

**Pros:**

- Zero runtime dependencies in the core — consumers using the SDK in Node.js or non-React environments get a clean install with nothing extra.
- The store is a plain class: any method can be called directly in a Vitest test without jsdom, a browser, or React test utilities.
- Concurrent-safe in React 18+ — `useSyncExternalStore` prevents "tearing", the subtle bug where different components see different snapshots of the same store during an async render. This is something Context-based approaches require careful memoization to avoid.
- Adding a Vue or Svelte adapter requires roughly the same ~5 lines of watcher code as the React hook. The core never changes.
- Immutable state transitions make change detection trivial — a reference inequality check on `getSnapshot()` is sufficient.

**Cons:**

- No built-in devtools. With Redux there would be a browser extension showing every action, current state, and time-travel history. Here, debugging requires logging `store.getSnapshot()` manually.
- The subscribe/snapshot pattern is less familiar than Context to developers who learned React state management through hooks alone. There is a short mental model shift before the wiring feels natural.
- Vanilla JS consumers must manage their own re-render cycle. The store fires a callback; what happens next is the consumer's responsibility.

---

### ADR-002 — Why the table virtualizes instead of paginating

A 5 MB JSON file can contain tens of thousands of rows. Rendering all of them at once is not viable: a 10 000-row table with 8 columns produces ~80 000 `<td>` elements, which causes multi-second initial paint and worsening scroll performance as the browser must style, layout, and paint everything.

The obvious fix is pagination, but pagination creates a workflow problem. A data reviewer needs to scan everything and flag errors. Navigating between pages breaks that flow. Sorting makes it worse — after re-sorting, page 1 shows an entirely different set of rows, and the reviewer loses their place.

**What virtualization does instead.** Only the rows currently visible in the viewport are mounted in the DOM, plus a 10-row overscan buffer above and below. As the user scrolls, rows outside the viewport are unmounted and new ones take their place. The scrollbar still behaves as if all rows were present — the container is padded with empty space equal to the height of the unmounted rows.

**The implementation uses two libraries from the TanStack ecosystem:**

- `@tanstack/react-table` — manages column definitions, sorting, and the full row model. Sorting is applied to all rows *before* the virtualizer sees them, so re-sorting works correctly without remounting anything.
- `@tanstack/react-virtual` — handles the windowing: reads the scroll position from a container ref and returns only the rows that should currently be in the DOM.

Both libraries are headless — they provide logic, not markup — so there are no CSS conflicts and the full Tailwind class system applies.

**What was considered and rejected:**

- *Pagination* — ruled out for the UX reasons above.
- *Infinite scroll (append-on-demand)* — simpler to build, but the DOM keeps growing as the user scrolls. After reading 5 000 rows, all 5 000 are mounted. The problem is deferred, not solved.

**What was gained:** DOM node count stays constant regardless of file size. Editing one cell re-renders only that cell — unchanged rows keep stable object references, so `React.memo` on `EditableCell` skips everything else.

**What was given up:** The table requires an explicit height (the `height` prop, defaulting to `"600px"`). Rows cannot dynamically expand to wrap long text without additional work to wire up `measureElement` in the virtualizer.

---

## Key trade-offs

### State management: subscribe/snapshot vs the alternatives

`useSyncExternalStore` is React 18's official primitive for binding to external state. It is concurrent-safe, which means it prevents "tearing" — the subtle bug where different components briefly see different versions of the same store during an async render. Context avoids tearing only with careful memoization that is easy to get wrong. Redux is also concurrent-safe but brings a much larger API surface for what is a focused, single-purpose SDK.

The subscription pattern is the lightest option that satisfies all three requirements: framework-agnostic core, concurrent-safe React binding, and minimal API surface.

### Rendering strategy: virtualization vs pagination

Virtualization is strictly harder to implement than pagination, but it is the right trade-off for a data review tool. The goal is to let reviewers scan everything efficiently. Pagination adds navigation between them and the data; virtualization removes those steps while keeping performance bounded regardless of dataset size.

### Third-party library choices

The frontend uses four non-trivial third-party libraries: `@tanstack/react-table`, `@tanstack/react-virtual`, shadcn/ui (Radix UI + CVA), and `date-fns`.

- **TanStack Table + Virtual** are both headless and TypeScript-native. Because they ship no styles, they compose cleanly with Tailwind. Both are actively maintained under a shared ecosystem with compatible APIs.
- **shadcn/ui** is not a traditional library — components are copied into the project rather than installed as a versioned dependency. There is no upstream version lock-in for UI primitives, but updates require manual re-generation with `npx shadcn@latest add <component>`.
- **date-fns** is a modular date utility library — only the functions used are included in the bundle. The alternative would be the native `Intl` API, but `date-fns` offers more consistent cross-browser date parsing and a friendlier surface for formatting.

The core SDK carries **zero runtime dependencies**, so none of these choices affect consumers who use the SDK without React.

---

## Commands

```bash
# Run demo app
pnpm --filter frontend dev

# Build all packages
pnpm -r build

# Build core SDK only
pnpm --filter @data-validator/validator-mastermind build

# Type-check everything
pnpm -r typecheck

# Lint frontend
pnpm --filter frontend lint
```

