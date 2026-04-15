// Email Analyzer — filter model, column definitions, operators, serialization,
// and a JS predicate evaluator used for post-aggregation (domain view) filtering.

export type ColumnDataType = "string" | "number" | "tags" | "imap_server" | "boolean" | "status";
export type FilterConjunction = "and" | "or";

// "email"       -> row in email_performance table
// "domain-pre"  -> filterable BEFORE aggregation (on email_performance rows)
// "domain-post" -> filterable AFTER aggregation (on the aggregated domain array)
export type FilterScope = "email" | "domain-pre" | "domain-post";

export interface FilterColumn {
  id: string;
  label: string;
  // For scope "email" / "domain-pre": DB column name (snake_case).
  // For scope "domain-post": key on the aggregated DomainPerformance object (camelCase).
  field: string;
  dataType: ColumnDataType;
  scope: FilterScope;
}

export interface FilterRow {
  id: string;
  columnId: string;
  operator: string;
  // value shape varies by operator:
  //   number                        -> number
  //   between                       -> [number, number]
  //   string contains/not_contains  -> string[]  (match any / match none)
  //   string equals/starts_with/…   -> string
  //   tags has_any/has_all/has_none -> string[]  (tag names; matched against
  //                                    the `name` field inside the JSONB
  //                                    tags array in email_performance)
  //   is_empty/is_not_empty         -> null (unused)
  value: string | number | [number, number] | string[] | null;
}

// `contains` and `does not contain` support a multi-value chip input where
// each chip is a distinct substring. "contains" matches if ANY chip is found;
// "does not contain" matches only if NO chip is found.
export function isMultiValueStringOp(opId: string): boolean {
  return opId === "contains" || opId === "not_contains";
}

export interface FilterState {
  conjunction: FilterConjunction;
  rows: FilterRow[];
}

export const EMPTY_FILTERS: FilterState = { conjunction: "and", rows: [] };

// ---------- Columns ----------

export const EMAIL_COLUMNS: FilterColumn[] = [
  { id: "email", label: "Email", field: "email", dataType: "string", scope: "email" },
  { id: "domain", label: "Domain", field: "domain", dataType: "string", scope: "email" },
  { id: "imap_server", label: "IMAP Server", field: "imap_server", dataType: "imap_server", scope: "email" },
  { id: "warmup_score", label: "Warmup Score", field: "warmup_score", dataType: "number", scope: "email" },
  { id: "reply_rate", label: "Reply Rate", field: "reply_rate", dataType: "number", scope: "email" },
  { id: "bounce_rate", label: "Bounce Rate", field: "bounce_rate", dataType: "number", scope: "email" },
  { id: "total_sent", label: "Sent", field: "total_sent", dataType: "number", scope: "email" },
  { id: "tags", label: "Tags", field: "tags", dataType: "tags", scope: "email" },
  { id: "status", label: "Status", field: "status", dataType: "status", scope: "email" },
  { id: "warmup_enabled", label: "Warmup Enabled", field: "warmup_enabled", dataType: "boolean", scope: "email" },
];

export const DOMAIN_COLUMNS: FilterColumn[] = [
  { id: "domain", label: "Domain", field: "domain", dataType: "string", scope: "domain-pre" },
  { id: "imap_server", label: "IMAP Server", field: "imap_server", dataType: "imap_server", scope: "domain-pre" },
  { id: "totalEmails", label: "Total Emails", field: "totalEmails", dataType: "number", scope: "domain-post" },
  { id: "totalSent", label: "Emails Sent", field: "totalSent", dataType: "number", scope: "domain-post" },
  { id: "avgWarmupScore", label: "Avg Warmup Score", field: "avgWarmupScore", dataType: "number", scope: "domain-post" },
  { id: "avgReplyRate", label: "Avg Reply Rate", field: "avgReplyRate", dataType: "number", scope: "domain-post" },
  { id: "avgBounceRate", label: "Avg Bounce Rate", field: "avgBounceRate", dataType: "number", scope: "domain-post" },
  // Matches against the union of tags across all senders in the domain.
  // Evaluated post-aggregation in JS by applyFilters() — the domain route
  // already attaches a `tags: Tag[]` union on each aggregated row.
  { id: "tags", label: "Tags", field: "tags", dataType: "tags", scope: "domain-post" },
];

// ---------- Operators ----------

export interface OperatorDef {
  id: string;
  label: string;
  // Whether this operator has a value input at all
  hasInput: boolean;
  // For numeric "between" — two inputs
  isRange?: boolean;
}

export const STRING_OPERATORS: OperatorDef[] = [
  { id: "contains", label: "contains", hasInput: true },
  { id: "not_contains", label: "does not contain", hasInput: true },
  { id: "equals", label: "equals", hasInput: true },
  { id: "not_equals", label: "does not equal", hasInput: true },
  { id: "starts_with", label: "starts with", hasInput: true },
  { id: "ends_with", label: "ends with", hasInput: true },
  { id: "is_empty", label: "is empty", hasInput: false },
  { id: "is_not_empty", label: "is not empty", hasInput: false },
];

export const NUMBER_OPERATORS: OperatorDef[] = [
  { id: "eq", label: "=", hasInput: true },
  { id: "neq", label: "!=", hasInput: true },
  { id: "gt", label: ">", hasInput: true },
  { id: "gte", label: ">=", hasInput: true },
  { id: "lt", label: "<", hasInput: true },
  { id: "lte", label: "<=", hasInput: true },
  { id: "between", label: "between", hasInput: true, isRange: true },
  { id: "is_empty", label: "is empty", hasInput: false },
  { id: "is_not_empty", label: "is not empty", hasInput: false },
];

export const TAGS_OPERATORS: OperatorDef[] = [
  { id: "has_any", label: "has any of", hasInput: true },
  { id: "has_all", label: "has all of", hasInput: true },
  { id: "has_none", label: "has none of", hasInput: true },
  { id: "is_empty", label: "is empty", hasInput: false },
  { id: "is_not_empty", label: "is not empty", hasInput: false },
];

export const IMAP_SERVER_OPERATORS: OperatorDef[] = [
  { id: "is_any_of", label: "is any of", hasInput: true },
  { id: "is_none_of", label: "is none of", hasInput: true },
  { id: "is_empty", label: "is empty", hasInput: false },
  { id: "is_not_empty", label: "is not empty", hasInput: false },
];

export const BOOLEAN_OPERATORS: OperatorDef[] = [
  { id: "is_true", label: "is enabled", hasInput: false },
  { id: "is_false", label: "is disabled", hasInput: false },
  { id: "is_empty", label: "is empty", hasInput: false },
  { id: "is_not_empty", label: "is not empty", hasInput: false },
];

export const STATUS_OPERATORS: OperatorDef[] = [
  { id: "is_any_of",    label: "is any of",    hasInput: true },
  { id: "is_none_of",   label: "is none of",   hasInput: true },
  { id: "is_empty",     label: "is empty",     hasInput: false },
  { id: "is_not_empty", label: "is not empty", hasInput: false },
];

export function getOperatorsForType(type: ColumnDataType): OperatorDef[] {
  switch (type) {
    case "string":      return STRING_OPERATORS;
    case "number":      return NUMBER_OPERATORS;
    case "tags":        return TAGS_OPERATORS;
    case "imap_server": return IMAP_SERVER_OPERATORS;
    case "boolean":     return BOOLEAN_OPERATORS;
    case "status":      return STATUS_OPERATORS;
  }
}

export function getOperatorDef(type: ColumnDataType, opId: string): OperatorDef | undefined {
  return getOperatorsForType(type).find((o) => o.id === opId);
}

export function getColumnById(columns: FilterColumn[], id: string): FilterColumn | undefined {
  return columns.find((c) => c.id === id);
}

// ---------- Validation ----------

export function isFilterRowComplete(row: FilterRow, columns: FilterColumn[]): boolean {
  const col = getColumnById(columns, row.columnId);
  if (!col) return false;
  const op = getOperatorDef(col.dataType, row.operator);
  if (!op) return false;
  if (!op.hasInput) return true;

  const v = row.value;
  if (v === null || v === undefined) return false;

  if (op.isRange) {
    return Array.isArray(v) && v.length === 2 && typeof v[0] === "number" && typeof v[1] === "number";
  }
  if (col.dataType === "number") {
    return typeof v === "number" && !Number.isNaN(v);
  }
  if (col.dataType === "string") {
    if (isMultiValueStringOp(row.operator)) {
      return Array.isArray(v) && v.length > 0 && v.every((s) => typeof s === "string" && s.length > 0);
    }
    return typeof v === "string" && v.length > 0;
  }
  if (col.dataType === "tags") {
    return Array.isArray(v) && v.length > 0 && v.every((s) => typeof s === "string" && s.length > 0);
  }
  if (col.dataType === "imap_server" || col.dataType === "status") {
    return Array.isArray(v) && v.length > 0 && v.every((s) => typeof s === "string" && s.length > 0);
  }
  if (col.dataType === "boolean") {
    return true; // all boolean operators have no input
  }
  return false;
}

// ---------- Serialization (state -> URL params) ----------

// Encoding format:
//   filter_conj=and
//   f[0][c]=total_sent
//   f[0][op]=gt
//   f[0][v]=5
//
// For `between`:
//   f[0][v]=10
//   f[0][v2]=20
//
// For tags (multiple names):
//   f[0][v][]=Outlook
//   f[0][v][]=Gmail
export function serializeFilters(state: FilterState, columns: FilterColumn[]): URLSearchParams {
  const params = new URLSearchParams();
  const complete = state.rows.filter((r) => isFilterRowComplete(r, columns));
  if (complete.length === 0) return params;

  params.set("filter_conj", state.conjunction);

  complete.forEach((row, i) => {
    const col = getColumnById(columns, row.columnId)!;
    params.set(`f[${i}][c]`, row.columnId);
    params.set(`f[${i}][op]`, row.operator);

    const op = getOperatorDef(col.dataType, row.operator)!;
    if (!op.hasInput) return;

    if (op.isRange && Array.isArray(row.value)) {
      params.set(`f[${i}][v]`, String(row.value[0]));
      params.set(`f[${i}][v2]`, String(row.value[1]));
      return;
    }
    if (col.dataType === "tags" && Array.isArray(row.value)) {
      for (const name of row.value as string[]) {
        params.append(`f[${i}][v][]`, name);
      }
      return;
    }
    if ((col.dataType === "imap_server" || col.dataType === "status") && Array.isArray(row.value)) {
      for (const name of row.value as string[]) {
        params.append(`f[${i}][v][]`, name);
      }
      return;
    }
    if (col.dataType === "string" && isMultiValueStringOp(row.operator) && Array.isArray(row.value)) {
      for (const s of row.value as string[]) {
        params.append(`f[${i}][v][]`, s);
      }
      return;
    }
    params.set(`f[${i}][v]`, String(row.value));
  });

  return params;
}

// Server-side parser — mirrors serializeFilters. Returns rows with unknown
// columns/operators filtered out (they're silently ignored, NOT an error).
export interface ParsedFilterRow {
  columnId: string;
  operator: string;
  value: string | number | [number, number] | string[] | null;
}

export interface ParsedFilters {
  conjunction: FilterConjunction;
  rows: ParsedFilterRow[];
}

export function parseFiltersFromParams(
  searchParams: URLSearchParams,
  columns: FilterColumn[],
): ParsedFilters {
  const conjRaw = searchParams.get("filter_conj");
  const conjunction: FilterConjunction = conjRaw === "or" ? "or" : "and";

  const rows: ParsedFilterRow[] = [];

  for (let i = 0; i < 50; i++) {
    const c = searchParams.get(`f[${i}][c]`);
    const op = searchParams.get(`f[${i}][op]`);
    if (!c || !op) break;

    const col = getColumnById(columns, c);
    if (!col) continue;
    const opDef = getOperatorDef(col.dataType, op);
    if (!opDef) continue;

    let value: ParsedFilterRow["value"] = null;
    if (opDef.hasInput) {
      if (opDef.isRange) {
        const v1 = Number(searchParams.get(`f[${i}][v]`));
        const v2 = Number(searchParams.get(`f[${i}][v2]`));
        if (Number.isNaN(v1) || Number.isNaN(v2)) continue;
        value = [v1, v2];
      } else if (col.dataType === "tags") {
        const names = searchParams.getAll(`f[${i}][v][]`).filter((s) => s.length > 0);
        if (names.length === 0) continue;
        value = names;
      } else if (col.dataType === "imap_server" || col.dataType === "status") {
        const names = searchParams.getAll(`f[${i}][v][]`).filter((s) => s.length > 0);
        if (names.length === 0) continue;
        value = names;
      } else if (col.dataType === "number") {
        const n = Number(searchParams.get(`f[${i}][v]`));
        if (Number.isNaN(n)) continue;
        value = n;
      } else if (col.dataType === "string" && isMultiValueStringOp(op)) {
        const arr = searchParams.getAll(`f[${i}][v][]`).filter((s) => s.length > 0);
        if (arr.length === 0) continue;
        value = arr;
      } else {
        const s = searchParams.get(`f[${i}][v]`);
        if (!s) continue;
        value = s;
      }
    }

    rows.push({ columnId: c, operator: op, value });
  }

  return { conjunction, rows };
}

// ---------- JS predicate evaluator (used for post-aggregation domain filters) ----------

// Evaluates a single parsed row against a record.
export function evaluateRow(
  row: ParsedFilterRow,
  record: Record<string, unknown>,
  columns: FilterColumn[],
): boolean {
  const col = getColumnById(columns, row.columnId);
  if (!col) return true;
  const raw = record[col.field];

  switch (row.operator) {
    case "is_empty":
      return raw === null || raw === undefined || raw === "" || (Array.isArray(raw) && raw.length === 0);
    case "is_not_empty":
      return !(raw === null || raw === undefined || raw === "" || (Array.isArray(raw) && raw.length === 0));
  }

  if (col.dataType === "number") {
    const n = Number(raw);
    if (Number.isNaN(n)) return false;
    switch (row.operator) {
      case "eq":  return n === row.value;
      case "neq": return n !== row.value;
      case "gt":  return n > (row.value as number);
      case "gte": return n >= (row.value as number);
      case "lt":  return n < (row.value as number);
      case "lte": return n <= (row.value as number);
      case "between": {
        const [lo, hi] = row.value as [number, number];
        return n >= lo && n <= hi;
      }
    }
  }

  if (col.dataType === "string") {
    const s = String(raw ?? "").toLowerCase();
    if (row.operator === "contains" || row.operator === "not_contains") {
      const vals: string[] = Array.isArray(row.value)
        ? (row.value as string[])
        : [String(row.value ?? "")];
      const anyMatch = vals.some((v) => s.includes(v.toLowerCase()));
      return row.operator === "contains" ? anyMatch : !anyMatch;
    }
    const v = String(row.value ?? "").toLowerCase();
    switch (row.operator) {
      case "equals":      return s === v;
      case "not_equals":  return s !== v;
      case "starts_with": return s.startsWith(v);
      case "ends_with":   return s.endsWith(v);
    }
  }

  if (col.dataType === "tags") {
    const tagNames = new Set<string>(
      Array.isArray(raw) ? (raw as Array<{ name: string }>).map((t) => t.name) : [],
    );
    const want = (row.value as string[]) ?? [];
    switch (row.operator) {
      case "has_any":  return want.some((name) => tagNames.has(name));
      case "has_all":  return want.every((name) => tagNames.has(name));
      case "has_none": return !want.some((name) => tagNames.has(name));
    }
  }

  if (col.dataType === "imap_server" || col.dataType === "status") {
    // In email view, raw is a single string (or null).
    // In domain view (aggregated), raw may be an array. Handle both gracefully.
    const values: string[] = Array.isArray(raw)
      ? (raw as string[])
      : raw ? [String(raw)] : [];
    const valuesLower = new Set(values.map((v) => v.toLowerCase()));
    const want = (row.value as string[]) ?? [];
    switch (row.operator) {
      case "is_any_of":  return want.some((w) => valuesLower.has(w.toLowerCase()));
      case "is_none_of": return !want.some((w) => valuesLower.has(w.toLowerCase()));
    }
  }

  if (col.dataType === "boolean") {
    switch (row.operator) {
      case "is_true":  return raw === true;
      case "is_false": return raw === false;
    }
  }

  return true;
}

// Runs a parsed filter set against an array of records. Used by the domain
// route for post-aggregation filtering, and by the UI for preview counts.
export function applyFilters<T extends Record<string, unknown>>(
  records: T[],
  filters: ParsedFilters,
  columns: FilterColumn[],
): T[] {
  if (filters.rows.length === 0) return records;
  const predicate = (rec: T): boolean => {
    if (filters.conjunction === "and") {
      return filters.rows.every((r) => evaluateRow(r, rec, columns));
    }
    return filters.rows.some((r) => evaluateRow(r, rec, columns));
  };
  return records.filter(predicate);
}

// ---------- Chip label helper (for the UI) ----------

export function describeFilterRow(row: FilterRow, columns: FilterColumn[]): string {
  const col = getColumnById(columns, row.columnId);
  if (!col) return "(invalid)";
  const op = getOperatorDef(col.dataType, row.operator);
  if (!op) return col.label;
  if (!op.hasInput) return `${col.label} ${op.label}`;

  if (op.isRange && Array.isArray(row.value)) {
    return `${col.label} ${op.label} ${row.value[0]}–${row.value[1]}`;
  }
  if (col.dataType === "tags" && Array.isArray(row.value)) {
    const names = row.value as string[];
    const preview = names.length <= 2 ? names.join(", ") : `${names.slice(0, 2).join(", ")} +${names.length - 2}`;
    return `${col.label} ${op.label} ${preview}`;
  }
  if ((col.dataType === "imap_server" || col.dataType === "status") && Array.isArray(row.value)) {
    const names = row.value as string[];
    const preview = names.length <= 2 ? names.join(", ") : `${names.slice(0, 2).join(", ")} +${names.length - 2}`;
    return `${col.label} ${op.label} ${preview}`;
  }
  if (col.dataType === "string" && isMultiValueStringOp(row.operator) && Array.isArray(row.value)) {
    const items = row.value as string[];
    const preview = items.length <= 2 ? items.join(", ") : `${items.slice(0, 2).join(", ")} +${items.length - 2}`;
    return `${col.label} ${op.label} ${preview}`;
  }
  return `${col.label} ${op.label} ${row.value ?? ""}`;
}

export function defaultValueForOperator(col: FilterColumn, op: OperatorDef): FilterRow["value"] {
  if (!op.hasInput) return null;
  if (op.isRange) return [0, 0];
  if (col.dataType === "number") return 0;
  if (col.dataType === "tags") return [];
  if (col.dataType === "imap_server" || col.dataType === "status") return [];
  if (col.dataType === "boolean") return null;
  if (col.dataType === "string") return isMultiValueStringOp(op.id) ? [] : "";
  return null;
}

export function newFilterRow(columns: FilterColumn[]): FilterRow {
  const first = columns[0];
  const op = getOperatorsForType(first.dataType)[0];
  return {
    id: Math.random().toString(36).slice(2, 10),
    columnId: first.id,
    operator: op.id,
    value: defaultValueForOperator(first, op),
  };
}
