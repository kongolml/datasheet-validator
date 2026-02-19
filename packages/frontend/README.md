# Datasheet Validator — Frontend

Vite + React 19 demo app that consumes the `[@data-validator/validator-mastermind](../validator-mastermind)` SDK. Not a publishable package — it serves as the integration example and manual-testing ground for the core library.

## Stack


| Tool                       | Version |
| -------------------------- | ------- |
| Vite                       | ^7      |
| React                      | ^19     |
| TypeScript                 | ~5.9    |
| Tailwind CSS               | ^4      |
| shadcn/ui (Radix UI + CVA) | —       |
| TanStack Table             | ^8      |
| TanStack Virtual           | ^3      |
| react-day-picker           | ^9      |
| lucide-react               | ^0.564  |


## Running locally

```bash
# From the repo root
pnpm install
pnpm --filter frontend dev   # http://localhost:5173
```

The app auto-loads `test-data.json` on mount so you see data immediately without uploading a file.

## Key patterns

### State management

`App.tsx` creates a `DataStore` with `useMemo` and subscribes to it with `useSyncExternalStore`:

```tsx
const store = useMemo(() => new DataStore(), [])
const state = useSyncExternalStore(
  useCallback((cb) => store.subscribe(cb), [store]),
  useCallback(() => store.getSnapshot(), [store]),
)
```

The store drives all rendering. React never owns data state — it only reacts to store changes.

### App screens

State is a discriminated union; `App.tsx` renders a different view per status:


| `state.status` | What renders                              |
| -------------- | ----------------------------------------- |
| `idle`         | `FileUpload` drop zone                    |
| `loading`      | Parsing spinner text                      |
| `error`        | `FileUpload` with error message           |
| `loaded`       | Validation errors table + full data table |


### DataTable

`DataTable` (`src/components/data-table.tsx`) builds TanStack Table column definitions dynamically from `Column[]`. Features:

- **Row virtualization** via `@tanstack/react-virtual` — only visible rows are rendered into the DOM, with 10-row overscan. Default height `600px`, configurable via `height` prop.
- **Column sorting** — click any column header to toggle asc/desc.
- **Row number column** — fixed leftmost column showing 1-based index.
- **Inline editing** via `EditableCell` (a `Popover`-based editor):
  - `string` / `number`: text input, commits on Enter or popover close
  - `boolean`: checkbox, commits immediately on toggle
  - `date`: calendar picker, commits immediately on date select
- **Validation errors**: cells with errors render in `text-destructive` with an `OctagonAlert` icon; hovering shows a tooltip with the full error messages.

### ValidationErrorsTable

`ValidationErrorsTable` (`src/components/validation-errors-table.tsx`) wraps `DataTable` in a collapsible `Accordion`. It filters to only rows with at least one validation error and renders nothing if there are none. Height is computed dynamically (capped at 400 px). Shown above the full table in `App.tsx`.

### FileUpload

`FileUpload` (`src/components/file-upload.tsx`) accepts JSON files via drag-and-drop or a file-browser button. Accepts `.json` / `application/json`, max 5 MB (enforced by the core SDK). Displays any error string passed via the `error` prop.

## Other commands

```bash
pnpm --filter frontend build    # production build
pnpm --filter frontend lint     # ESLint
pnpm -r typecheck               # type-check all packages
```

