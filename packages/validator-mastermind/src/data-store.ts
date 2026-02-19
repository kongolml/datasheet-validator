import { parse } from "./parse";
import { validateAllRows, validateCell } from "./validate";
import type {
  CellEdit,
  CellValue,
  Column,
  DataSet,
  DataStoreOptions,
  DataStoreState,
  Row,
  Subscriber,
  Unsubscribe,
  ValidationRule,
} from "./types";
import { DataValidatorError, FileSizeError } from "./types";

const DEFAULT_OPTIONS: Required<DataStoreOptions> = {
  maxFileSize: 5 * 1024 * 1024,
  maxNestingDepth: 1,
  validationRules: {},
};

export class DataStore {
  private state: DataStoreState = { status: "idle" };
  private subscribers: Set<Subscriber> = new Set();
  private options: Required<DataStoreOptions>;
  constructor(options: DataStoreOptions = {}) {
    this.options = {
      ...DEFAULT_OPTIONS,
      ...options,
      validationRules: { ...(options.validationRules ?? {}) },
    };
  }

  // ── State Access ──────────────────────────────────────────────────────

  getState(): DataStoreState {
    return this.state;
  }

  getSnapshot(): DataStoreState {
    return this.state;
  }

  getData(): DataSet | null {
    if (this.state.status === "loaded") {
      return this.state.data;
    }
    return null;
  }

  getRows(): Row[] {
    return this.getData()?.rows ?? [];
  }

  getColumns(): Column[] {
    return this.getData()?.columns ?? [];
  }

  getRow(rowId: string): Row | undefined {
    return this.getRows().find((r) => r.id === rowId);
  }

  getCellValue(rowId: string, columnKey: string): CellValue | undefined {
    const row = this.getRow(rowId);
    return row?.cells[columnKey];
  }

  // ── Data Loading ──────────────────────────────────────────────────────

  loadFromString(jsonString: string, fileName: string = "unknown"): void {
    this.setState({ status: "loading" });

    try {
      const dataSet = parse(jsonString, {
        maxFileSize: this.options.maxFileSize,
        maxNestingDepth: this.options.maxNestingDepth,
        fileName,
      });

      const columnsWithRules = this.applyValidationRules(dataSet.columns);
      const validatedRows = validateAllRows(dataSet.rows, columnsWithRules);

      this.setState({
        status: "loaded",
        data: {
          ...dataSet,
          columns: columnsWithRules,
          rows: validatedRows,
        },
      });
    } catch (error) {
      if (error instanceof DataValidatorError) {
        this.setState({ status: "error", error });
      } else {
        this.setState({
          status: "error",
          error: new DataValidatorError(
            "UNKNOWN_ERROR",
            error instanceof Error
              ? error.message
              : "An unknown error occurred",
          ),
        });
      }
    }
  }

  async loadFromFile(file: File): Promise<void> {
    this.setState({ status: "loading" });

    if (file.size > this.options.maxFileSize) {
      this.setState({
        status: "error",
        error: new FileSizeError(file.size, this.options.maxFileSize),
      });
      return;
    }

    try {
      const text = await file.text();
      this.loadFromString(text, file.name);
    } catch (error) {
      this.setState({
        status: "error",
        error: new DataValidatorError(
          "FILE_READ_ERROR",
          error instanceof Error ? error.message : "Failed to read file",
        ),
      });
    }
  }

  // ── Editing ───────────────────────────────────────────────────────────

  updateCell(rowId: string, columnKey: string, value: CellValue): void {
    if (this.state.status !== "loaded") return;

    const { data } = this.state;
    const rowIndex = data.rows.findIndex((r) => r.id === rowId);
    if (rowIndex === -1) return;

    const column = data.columns.find((c) => c.key === columnKey);
    if (!column) return;

    const row = data.rows[rowIndex]!;
    const newCells = { ...row.cells, [columnKey]: value };

    const cellErrors = validateCell(value, column);
    const newErrors = { ...row.errors };
    if (cellErrors.length > 0) {
      newErrors[columnKey] = cellErrors;
    } else {
      delete newErrors[columnKey];
    }

    const newRow: Row = { ...row, cells: newCells, errors: newErrors };
    const newRows = [...data.rows];
    newRows[rowIndex] = newRow;

    this.setState({
      status: "loaded",
      data: { ...data, rows: newRows },
    });
  }

  batchUpdateCells(edits: CellEdit[]): void {
    if (this.state.status !== "loaded") return;

    const { data } = this.state;
    const newRows = [...data.rows];
    const rowIndexMap = new Map<string, number>();
    data.rows.forEach((row, i) => rowIndexMap.set(row.id, i));

    for (const edit of edits) {
      const rowIndex = rowIndexMap.get(edit.rowId);
      if (rowIndex === undefined) continue;

      const column = data.columns.find((c) => c.key === edit.columnKey);
      if (!column) continue;

      const row = newRows[rowIndex]!;
      const newCells = { ...row.cells, [edit.columnKey]: edit.value };
      const cellErrors = validateCell(edit.value, column);
      const newErrors = { ...row.errors };

      if (cellErrors.length > 0) {
        newErrors[edit.columnKey] = cellErrors;
      } else {
        delete newErrors[edit.columnKey];
      }

      newRows[rowIndex] = { ...row, cells: newCells, errors: newErrors };
    }

    this.setState({
      status: "loaded",
      data: { ...data, rows: newRows },
    });
  }

  addValidationRules(columnKey: string, rules: ValidationRule[]): void {
    this.options.validationRules[columnKey] = [
      ...(this.options.validationRules[columnKey] ?? []),
      ...rules,
    ];

    if (this.state.status === "loaded") {
      const columnsWithRules = this.applyValidationRules(
        this.state.data.columns,
      );
      const validatedRows = validateAllRows(
        this.state.data.rows,
        columnsWithRules,
      );
      this.setState({
        status: "loaded",
        data: {
          ...this.state.data,
          columns: columnsWithRules,
          rows: validatedRows,
        },
      });
    }
  }

  // ── State Management ──────────────────────────────────────────────────

  reset(): void {
    this.setState({ status: "idle" });
  }

  getErrorCount(): number {
    if (this.state.status !== "loaded") return 0;
    return this.state.data.rows.reduce(
      (count, row) => count + Object.keys(row.errors).length,
      0,
    );
  }

  getRowsWithErrors(): Row[] {
    if (this.state.status !== "loaded") return [];
    return this.state.data.rows.filter(
      (row) => Object.keys(row.errors).length > 0,
    );
  }

  exportData(): Record<string, CellValue>[] | null {
    if (this.state.status !== "loaded") return null;
    return this.state.data.rows.map((row) => ({ ...row.cells }));
  }

  // ── Subscriptions ─────────────────────────────────────────────────────

  subscribe(subscriber: Subscriber): Unsubscribe {
    this.subscribers.add(subscriber);
    return () => {
      this.subscribers.delete(subscriber);
    };
  }

  // ── Private ───────────────────────────────────────────────────────────

  private setState(newState: DataStoreState): void {
    this.state = newState;
    this.notify();
  }

  private notify(): void {
    for (const subscriber of this.subscribers) {
      subscriber();
    }
  }

  private applyValidationRules(columns: Column[]): Column[] {
    return columns.map((column) => {
      const rules = this.options.validationRules[column.key];
      if (!rules) return column;
      return {
        ...column,
        validation: [...(column.validation ?? []), ...rules],
      };
    });
  }
}
