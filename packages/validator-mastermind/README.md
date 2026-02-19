# @data-validator/validator-mastermind

Framework-agnostic SDK for uploading, reviewing, and correcting structured JSON data.

## Quick Start

```typescript
import { DataStore, CellTypes, ValidationRuleTypes } from "@data-validator/validator-mastermind";

const store = new DataStore({
  maxFileSize: 5 * 1024 * 1024, // 5MB
  validationRules: {
    age: [{ type: ValidationRuleTypes.MIN, value: 0 }],
  },
});

// Subscribe before loading to catch the initial state change
const unsubscribe = store.subscribe(() => {
  console.log("State changed:", store.getState());
});

// Load JSON data
store.loadFromString(
  JSON.stringify([
    { name: "Alice", age: 30 },
    { name: "Bob", age: 25 },
  ]),
  "users.json"
);

// Read state
const state = store.getState(); // { status: 'loaded', data: DataSet }
const rows = store.getRows();
const columns = store.getColumns(); // auto-inferred types

// Edit a cell
store.updateCell(rows[0].id, "age", 31);

// Check validation errors
console.log(store.getErrorCount());
console.log(store.getRowsWithErrors());

// Export clean data
const data = store.exportData();

unsubscribe();
```

## API

### `new DataStore(options?)`


| Option            | Type                               | Default         | Description                             |
| ----------------- | ---------------------------------- | --------------- | --------------------------------------- |
| `maxFileSize`     | `number`                           | `5242880` (5MB) | Maximum file size in bytes              |
| `maxNestingDepth` | `number`                           | `1`             | Maximum nesting depth in JSON objects   |
| `validationRules` | `Record<string, ValidationRule[]>` | `{}`            | Validation rules applied per column key |


### `DataStore` methods


| Method                                 | Description                                                |
| -------------------------------------- | ---------------------------------------------------------- |
| `loadFromString(json, fileName?)`      | Parse JSON string and load data                            |
| `loadFromFile(file)`                   | Load from a `File` object (async)                          |
| `getState()`                           | Current state (`idle` / `loading` / `loaded` / `error`)    |
| `getSnapshot()`                        | Alias for `getState()` — `useSyncExternalStore` compatible |
| `getData()`                            | Get the `DataSet` or `null`                                |
| `getRows()` / `getColumns()`           | Convenience accessors                                      |
| `getRow(rowId)`                        | Get a single row by ID                                     |
| `getCellValue(rowId, columnKey)`       | Get a single cell value                                    |
| `updateCell(rowId, columnKey, value)`  | Edit a single cell (immutable update)                      |
| `batchUpdateCells(edits)`              | Edit multiple cells in one notification                    |
| `addValidationRules(columnKey, rules)` | Add validation rules for a column; triggers re-validation  |
| `subscribe(callback)`                  | Subscribe to state changes, returns unsubscribe fn         |
| `getErrorCount()`                      | Total validation errors across all rows                    |
| `getRowsWithErrors()`                  | Rows with at least one error                               |
| `exportData()`                         | Export rows as plain objects                               |
| `reset()`                              | Return to idle state                                       |


### `parse(input, options?)`

Standalone JSON parser. Returns a `DataSet` with auto-inferred column types. Throws `ParseError` on malformed input, wrong structure, or empty input.

```typescript
import { parse } from "@data-validator/validator-mastermind";

const dataSet = parse(jsonString, {
  maxFileSize: 5 * 1024 * 1024,
  maxNestingDepth: 1,
  fileName: "data.json",
});
```

### Standalone validation

```typescript
import {
  validateCell,
  validateRow,
  validateAllRows,
} from "@data-validator/validator-mastermind";

const errors = validateCell(value, column);           // ValidationError[]
const rowErrors = validateRow(row, columns);          // Record<string, ValidationError[]>
const validatedRows = validateAllRows(rows, columns); // Row[] with errors populated
```

### `ValidationRuleTypes`

```typescript
import { ValidationRuleTypes } from "@data-validator/validator-mastermind";

ValidationRuleTypes.REQUIRED;   // 'required'
ValidationRuleTypes.MIN;        // 'min'
ValidationRuleTypes.MAX;        // 'max'
ValidationRuleTypes.PATTERN;    // 'pattern'
ValidationRuleTypes.MIN_LENGTH; // 'min-length'
ValidationRuleTypes.MAX_LENGTH; // 'max-length'
```

### `CellTypes`

```typescript
import { CellTypes } from "@data-validator/validator-mastermind";

CellTypes.STRING;  // 'string'
CellTypes.NUMBER;  // 'number'
CellTypes.BOOLEAN; // 'boolean'
CellTypes.DATE;    // 'date'
```

### Error classes

All errors extend `DataValidatorError` (has `.code: string`).

```typescript
import {
  DataValidatorError,
  ParseError,
  FileSizeError,
  ValidationFailedError,
} from "@data-validator/validator-mastermind";

try {
  store.loadFromString(json);
} catch (err) {
  if (err instanceof ParseError) {
    // err.code === 'PARSE_ERROR'
  } else if (err instanceof FileSizeError) {
    // err.code === 'FILE_SIZE_ERROR'
  } else if (err instanceof DataValidatorError) {
    // catches all SDK errors
  }
}
```

> Note: `loadFromString` and `loadFromFile` do not throw — errors are captured in state as `{ status: 'error', error: DataValidatorError }`. The error classes are useful when using `parse()` directly.

## React integration

```tsx
import { useMemo, useCallback } from "react";
import { useSyncExternalStore } from "react";
import { DataStore } from "@data-validator/validator-mastermind";

function App() {
  const store = useMemo(() => new DataStore(), []);
  const state = useSyncExternalStore(
    useCallback((cb) => store.subscribe(cb), [store]),
    useCallback(() => store.getSnapshot(), [store]),
  );

  if (state.status === "loaded") {
    return <div>{state.data.rows.length} rows loaded</div>;
  }
}
```

