export const CellTypes = {
  STRING: "string",
  NUMBER: "number",
  BOOLEAN: "boolean",
  DATE: "date",
} as const;

export type CellType = (typeof CellTypes)[keyof typeof CellTypes];

export const ValidationRuleTypes = {
  REQUIRED: "required",
  MIN: "min",
  MAX: "max",
  PATTERN: "pattern",
  MIN_LENGTH: "min-length",
  MAX_LENGTH: "max-length",
} as const;

export type ValidationRuleType =
  (typeof ValidationRuleTypes)[keyof typeof ValidationRuleTypes];

export const ValidationMessages = {
  EXPECTED_NUMBER: "Expected a number value",
  EXPECTED_BOOLEAN: "Expected a boolean value",
  EXPECTED_DATE: "Expected a valid date",
  REQUIRED: "This field is required",
  MIN: (min: number) => `Value must be at least ${min}`,
  MAX: (max: number) => `Value must be at most ${max}`,
  PATTERN: "Value does not match required pattern",
  MIN_LENGTH: (min: number) => `Value must be at least ${min} characters`,
  MAX_LENGTH: (max: number) => `Value must be at most ${max} characters`,
} as const;

export interface ValidationRule {
  type: ValidationRuleType;
  value?: string | number;
  message?: string;
}

export interface ValidationError {
  rule: ValidationRuleType;
  message: string;
  column: string;
}

export interface Column {
  key: string;
  label: string;
  type: CellType;
  validation?: ValidationRule[];
}

export type CellValue = string | number | boolean | null;

export interface Row {
  id: string;
  cells: Record<string, CellValue>;
  errors: Record<string, ValidationError[]>;
}

export interface DataSetMetadata {
  fileName: string;
  rowCount: number;
  columnCount: number;
  importedAt: string;
}

export interface DataSet {
  columns: Column[];
  rows: Row[];
  metadata: DataSetMetadata;
}

export interface CellEdit {
  rowId: string;
  columnKey: string;
  value: CellValue;
}

export interface DataStoreOptions {
  maxFileSize?: number;
  maxNestingDepth?: number;
  validationRules?: Record<string, ValidationRule[]>;
}

export type DataStoreState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "loaded"; data: DataSet }
  | { status: "error"; error: DataValidatorError };

export type Subscriber = () => void;
export type Unsubscribe = () => void;

export interface ParseOptions {
  maxFileSize?: number;
  maxNestingDepth?: number;
  fileName?: string;
}

export class DataValidatorError extends Error {
  public readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "DataValidatorError";
    this.code = code;
  }
}

export class ParseError extends DataValidatorError {
  constructor(message: string) {
    super("PARSE_ERROR", message);
    this.name = "ParseError";
  }
}

export class ValidationFailedError extends DataValidatorError {
  public readonly cellErrors: ValidationError[];

  constructor(message: string, cellErrors: ValidationError[]) {
    super("VALIDATION_ERROR", message);
    this.name = "ValidationFailedError";
    this.cellErrors = cellErrors;
  }
}

export class FileSizeError extends DataValidatorError {
  constructor(size: number, maxSize: number) {
    super(
      "FILE_SIZE_ERROR",
      `File size ${(size / 1024 / 1024).toFixed(2)}MB exceeds maximum allowed size of ${(maxSize / 1024 / 1024).toFixed(2)}MB`,
    );
    this.name = "FileSizeError";
  }
}
