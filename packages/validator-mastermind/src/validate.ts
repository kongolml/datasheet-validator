import type {
  CellValue,
  CellType,
  Column,
  Row,
  ValidationError,
  ValidationRule,
} from "./types";
import { CellTypes, ValidationMessages, ValidationRuleTypes } from "./types";

export function validateCell(
  value: CellValue,
  column: Column,
): ValidationError[] {
  const errors: ValidationError[] = [];

  const typeErrors = validateType(value, column.type, column.key);
  errors.push(...typeErrors);

  if (column.validation) {
    for (const rule of column.validation) {
      const ruleError = validateRule(value, rule, column.key);
      if (ruleError) {
        errors.push(ruleError);
      }
    }
  }

  return errors;
}

export function validateRow(
  row: Row,
  columns: Column[],
): Record<string, ValidationError[]> {
  const errors: Record<string, ValidationError[]> = {};

  for (const column of columns) {
    const value = row.cells[column.key] ?? null;
    const cellErrors = validateCell(value, column);
    if (cellErrors.length > 0) {
      errors[column.key] = cellErrors;
    }
  }

  return errors;
}

export function validateAllRows(rows: Row[], columns: Column[]): Row[] {
  return rows.map((row) => {
    const errors = validateRow(row, columns);
    return { ...row, errors };
  });
}

function validateType(
  value: CellValue,
  type: CellType,
  columnKey: string,
): ValidationError[] {
  if (value === null) return [];

  switch (type) {
    case CellTypes.NUMBER: {
      if (typeof value === "number") return [];
      if (typeof value === "string") {
        const num = Number(value);
        if (!isNaN(num) && value.trim() !== "") return [];
      }
      return [
        {
          rule: ValidationRuleTypes.REQUIRED,
          message: ValidationMessages.EXPECTED_NUMBER,
          column: columnKey,
        },
      ];
    }

    case CellTypes.BOOLEAN: {
      if (typeof value === "boolean") return [];
      if (typeof value === "string") {
        const lower = value.toLowerCase();
        if (["true", "false", "yes", "no", "1", "0"].includes(lower))
          return [];
      }
      return [
        {
          rule: ValidationRuleTypes.REQUIRED,
          message: ValidationMessages.EXPECTED_BOOLEAN,
          column: columnKey,
        },
      ];
    }

    case CellTypes.DATE: {
      if (typeof value === "string") {
        const date = new Date(value);
        if (!isNaN(date.getTime())) return [];
      }
      return [
        {
          rule: ValidationRuleTypes.REQUIRED,
          message: ValidationMessages.EXPECTED_DATE,
          column: columnKey,
        },
      ];
    }

    case CellTypes.STRING:
    default:
      return [];
  }
}

function validateRule(
  value: CellValue,
  rule: ValidationRule,
  columnKey: string,
): ValidationError | null {
  switch (rule.type) {
    case ValidationRuleTypes.REQUIRED:
      if (value === null || value === undefined || value === "") {
        return {
          rule: ValidationRuleTypes.REQUIRED,
          message: rule.message ?? ValidationMessages.REQUIRED,
          column: columnKey,
        };
      }
      return null;

    case ValidationRuleTypes.MIN:
      if (typeof value === "number" && typeof rule.value === "number") {
        if (value < rule.value) {
          return {
            rule: ValidationRuleTypes.MIN,
            message: rule.message ?? ValidationMessages.MIN(rule.value),
            column: columnKey,
          };
        }
      }
      return null;

    case ValidationRuleTypes.MAX:
      if (typeof value === "number" && typeof rule.value === "number") {
        if (value > rule.value) {
          return {
            rule: ValidationRuleTypes.MAX,
            message: rule.message ?? ValidationMessages.MAX(rule.value),
            column: columnKey,
          };
        }
      }
      return null;

    case ValidationRuleTypes.PATTERN:
      if (typeof value === "string" && typeof rule.value === "string") {
        const regex = new RegExp(rule.value);
        if (!regex.test(value)) {
          return {
            rule: ValidationRuleTypes.PATTERN,
            message: rule.message ?? ValidationMessages.PATTERN,
            column: columnKey,
          };
        }
      }
      return null;

    case ValidationRuleTypes.MIN_LENGTH:
      if (typeof value === "string" && typeof rule.value === "number") {
        if (value.length < rule.value) {
          return {
            rule: ValidationRuleTypes.MIN_LENGTH,
            message:
              rule.message ?? ValidationMessages.MIN_LENGTH(rule.value),
            column: columnKey,
          };
        }
      }
      return null;

    case ValidationRuleTypes.MAX_LENGTH:
      if (typeof value === "string" && typeof rule.value === "number") {
        if (value.length > rule.value) {
          return {
            rule: ValidationRuleTypes.MAX_LENGTH,
            message:
              rule.message ?? ValidationMessages.MAX_LENGTH(rule.value),
            column: columnKey,
          };
        }
      }
      return null;

    default:
      return null;
  }
}
