# Data Validator

A monorepo SDK for uploading, reviewing, and correcting structured JSON data before it enters a system. Ships a framework-agnostic core package and a Vite-based demo app.

## Packages


| Package                                                                 | Description                                                         |
| ----------------------------------------------------------------------- | ------------------------------------------------------------------- |
| @data-validator/validator-mastermind | Framework-agnostic core SDK — parsing, validation, state management |
| frontend (React)                                         | Vite + React 19 demo app consuming the SDK                          |


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

