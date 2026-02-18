import {
  type CellType,
  type CellValue,
  type Column,
  type DataSet,
  type Row,
  type ParseOptions,
  CellTypes,
  ParseError,
  FileSizeError,
} from "./types";

const DEFAULT_MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const DEFAULT_MAX_NESTING_DEPTH = 1;

export function parse(input: string, options: ParseOptions = {}): DataSet {
  const {
    maxFileSize = DEFAULT_MAX_FILE_SIZE,
    maxNestingDepth = DEFAULT_MAX_NESTING_DEPTH,
    fileName = "unknown",
  } = options;

  const byteSize = new TextEncoder().encode(input).length;
  if (byteSize > maxFileSize) {
    throw new FileSizeError(byteSize, maxFileSize);
  }

  if (input.trim().length === 0) {
    throw new ParseError("File is empty");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(input);
  } catch {
    throw new ParseError("Invalid JSON: file could not be parsed");
  }

  if (!Array.isArray(parsed)) {
    throw new ParseError(
      "Unsupported structure: expected a JSON array of objects",
    );
  }

  if (parsed.length === 0) {
    throw new ParseError("Empty dataset: the JSON array contains no records");
  }

  const records = parsed as unknown[];

  for (let i = 0; i < records.length; i++) {
    const record = records[i];
    if (record === null || typeof record !== "object" || Array.isArray(record)) {
      throw new ParseError(
        `Invalid record at index ${i}: expected a flat object`,
      );
    }
    validateNesting(record as Record<string, unknown>, i, maxNestingDepth, 0);
  }

  const firstRecord = records[0] as Record<string, unknown>;
  const columnKeys = Object.keys(firstRecord);

  if (columnKeys.length === 0) {
    throw new ParseError("No columns found: the first record has no keys");
  }

  const columns: Column[] = columnKeys.map((key) => ({
    key,
    label: formatLabel(key),
    type: inferColumnType(records as Record<string, unknown>[], key),
  }));

  const rows: Row[] = (records as Record<string, unknown>[]).map(
    (record, index) => ({
      id: generateRowId(index),
      cells: buildCells(record, columns),
      errors: {},
    }),
  );

  return {
    columns,
    rows,
    metadata: {
      fileName,
      rowCount: rows.length,
      columnCount: columns.length,
      importedAt: new Date().toISOString(),
    },
  };
}

function validateNesting(
  obj: Record<string, unknown>,
  recordIndex: number,
  maxDepth: number,
  currentDepth: number,
): void {
  for (const [key, value] of Object.entries(obj)) {
    if (value !== null && typeof value === "object" && !Array.isArray(value)) {
      if (currentDepth >= maxDepth) {
        throw new ParseError(
          `Unsupported structure: deeply nested object at record ${recordIndex}, key "${key}". Maximum nesting depth is ${maxDepth}`,
        );
      }
      validateNesting(
        value as Record<string, unknown>,
        recordIndex,
        maxDepth,
        currentDepth + 1,
      );
    }
    if (Array.isArray(value)) {
      throw new ParseError(
        `Unsupported structure: array value at record ${recordIndex}, key "${key}". Only flat objects are supported`,
      );
    }
  }
}

function inferColumnType(
  records: Record<string, unknown>[],
  key: string,
): CellType {
  const typeCounts: Record<string, number> = {};

  for (const record of records) {
    const value = record[key];
    if (value === null || value === undefined) continue;

    const detectedType = detectValueType(value);
    typeCounts[detectedType] = (typeCounts[detectedType] ?? 0) + 1;
  }

  let bestType: CellType = CellTypes.STRING;
  let bestCount = 0;

  for (const [type, count] of Object.entries(typeCounts)) {
    if (count > bestCount) {
      bestType = type as CellType;
      bestCount = count;
    }
  }

  return bestType;
}

function detectValueType(value: unknown): CellType {
  if (typeof value === "boolean") return CellTypes.BOOLEAN;
  if (typeof value === "number") return CellTypes.NUMBER;
  if (typeof value === "string") {
    if (isDateString(value)) return CellTypes.DATE;
    return CellTypes.STRING;
  }
  return CellTypes.STRING;
}

function isDateString(value: string): boolean {
  const datePatterns = [
    /^\d{4}-\d{2}-\d{2}$/,
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/,
    /^\d{2}\/\d{2}\/\d{4}$/,
  ];

  if (!datePatterns.some((p) => p.test(value))) return false;
  // Normalize space before timezone offset: "2025-01-01T10:00:00 -01:00" → "2025-01-01T10:00:00-01:00"
  const normalized = value.replace(/(\d) ([+-]\d{2}:\d{2})$/, "$1$2");
  const date = new Date(normalized);
  return !isNaN(date.getTime());
}

function formatLabel(key: string): string {
  return key
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/[_-]/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function buildCells(
  record: Record<string, unknown>,
  columns: Column[],
): Record<string, CellValue> {
  const cells: Record<string, CellValue> = {};

  for (const column of columns) {
    const raw = record[column.key];
    cells[column.key] = coerceValue(raw);
  }

  return cells;
}

function coerceValue(value: unknown): CellValue {
  if (value === null || value === undefined) return null;
  if (typeof value === "string") return value;
  if (typeof value === "number") return value;
  if (typeof value === "boolean") return value;
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

let rowIdCounter = 0;

function generateRowId(index: number): string {
  rowIdCounter++;
  return `row-${index}-${rowIdCounter}-${Date.now().toString(36)}`;
}
