// Server-only helpers: translate ParsedFilters into Supabase query mutations.
// Split from email-analyzer-filters.ts so that file stays client-safe.

/* eslint-disable @typescript-eslint/no-explicit-any */

import {
  getColumnById,
  getOperatorDef,
  type FilterColumn,
  type ParsedFilterRow,
  type ParsedFilters,
} from "@/lib/email-analyzer-filters";

// We accept a loosely-typed Supabase filter builder. The real types from
// @supabase/postgrest-js are heavily generic and don't round-trip well through
// our own helper without polluting every caller.
type SbQuery = any;

// Escape a value for use inside a Supabase `.or()` expression.
// Commas, parentheses, periods, and quotes inside a value must be wrapped in
// double quotes per PostgREST grammar.
function escapeOrValue(raw: string): string {
  if (raw === "") return '""';
  if (/[,()."]/.test(raw)) {
    return `"${raw.replace(/"/g, '\\"')}"`;
  }
  return raw;
}

function cleanedStar(raw: string): string {
  // Within `.or()`, ilike uses `*` as the wildcard. Strip user-supplied `*`
  // to avoid accidental wildcarding, then escape the result.
  return escapeOrValue(raw.replace(/\*/g, ""));
}

// Convert a single parsed row into one or more PostgREST `.or()` clause
// fragments. Returns [] if the row can't be represented in OR mode.
//
// Multi-value `contains` expands to one clause per value (joined by OR at
// the top level). Multi-value `not_contains` collapses into a single
// `and(...)` group because "none of" = "not a AND not b AND not c".
function rowToOrClauses(row: ParsedFilterRow, col: FilterColumn): string[] {
  const field = col.field;
  const op = getOperatorDef(col.dataType, row.operator);
  if (!op) return [];

  // Tags in OR mode: complex JSONB `cs` inside .or() is fragile. Skip.
  if (col.dataType === "tags") return [];

  if (col.dataType === "imap_server" || col.dataType === "status") {
    const names = (row.value as string[]) ?? [];
    switch (row.operator) {
      case "is_any_of":
        return names.map((n) => `${field}.eq.${escapeOrValue(n)}`);
      case "is_none_of": {
        const parts = names.map((n) => `not.${field}.eq.${escapeOrValue(n)}`);
        return [`and(${parts.join(",")})`];
      }
    }
    return [];
  }

  if (col.dataType === "boolean") {
    switch (row.operator) {
      case "is_true":  return [`${field}.eq.true`];
      case "is_false": return [`${field}.eq.false`];
    }
    return [];
  }

  switch (row.operator) {
    case "is_empty": return [`${field}.is.null`];
    case "is_not_empty": return [`not.${field}.is.null`];
  }

  if (col.dataType === "number") {
    switch (row.operator) {
      case "eq":  return [`${field}.eq.${row.value}`];
      case "neq": return [`${field}.neq.${row.value}`];
      case "gt":  return [`${field}.gt.${row.value}`];
      case "gte": return [`${field}.gte.${row.value}`];
      case "lt":  return [`${field}.lt.${row.value}`];
      case "lte": return [`${field}.lte.${row.value}`];
      case "between": {
        const [lo, hi] = row.value as [number, number];
        return [`and(${field}.gte.${lo},${field}.lte.${hi})`];
      }
    }
  }

  if (col.dataType === "string") {
    // Multi-value contains / not_contains
    if (row.operator === "contains" || row.operator === "not_contains") {
      const vals: string[] = Array.isArray(row.value)
        ? (row.value as string[])
        : [String(row.value ?? "")];
      if (vals.length === 0) return [];
      if (row.operator === "contains") {
        return vals.map((v) => `${field}.ilike.*${cleanedStar(v)}*`);
      }
      // not_contains (none of): and(not.a,not.b,not.c)
      const parts = vals.map((v) => `not.${field}.ilike.*${cleanedStar(v)}*`);
      return [`and(${parts.join(",")})`];
    }

    const raw = String(row.value ?? "");
    const esc = cleanedStar(raw);
    const escExact = escapeOrValue(raw);
    switch (row.operator) {
      case "equals":      return [`${field}.eq.${escExact}`];
      case "not_equals":  return [`${field}.neq.${escExact}`];
      case "starts_with": return [`${field}.ilike.${esc}*`];
      case "ends_with":   return [`${field}.ilike.*${esc}`];
    }
  }

  return [];
}

// AND-mode: chain builder methods directly.
function applyRowAnd(query: SbQuery, row: ParsedFilterRow, col: FilterColumn): SbQuery {
  const field = col.field;

  switch (row.operator) {
    case "is_empty": return query.is(field, null);
    case "is_not_empty": return query.not(field, "is", null);
  }

  if (col.dataType === "number") {
    switch (row.operator) {
      case "eq":  return query.eq(field, row.value);
      case "neq": return query.neq(field, row.value);
      case "gt":  return query.gt(field, row.value);
      case "gte": return query.gte(field, row.value);
      case "lt":  return query.lt(field, row.value);
      case "lte": return query.lte(field, row.value);
      case "between": {
        const [lo, hi] = row.value as [number, number];
        return query.gte(field, lo).lte(field, hi);
      }
    }
  }

  if (col.dataType === "string") {
    // Multi-value contains / not_contains
    if (row.operator === "contains" || row.operator === "not_contains") {
      const vals: string[] = Array.isArray(row.value)
        ? (row.value as string[])
        : [String(row.value ?? "")];
      if (vals.length === 0) return query;
      if (row.operator === "contains") {
        // Single value: direct .ilike() keeps things simple.
        if (vals.length === 1) {
          return query.ilike(field, `%${vals[0]}%`);
        }
        // Multi value: wrap in a single `.or()` so the set acts as one OR
        // group within the outer AND chain.
        const clauses = vals.map((v) => `${field}.ilike.*${cleanedStar(v)}*`).join(",");
        return query.or(clauses);
      }
      // not_contains = "none of" → AND-chain of .not() per value
      let q = query;
      for (const v of vals) {
        q = q.not(field, "ilike", `%${v}%`);
      }
      return q;
    }

    const v = String(row.value ?? "");
    switch (row.operator) {
      case "equals":      return query.eq(field, v);
      case "not_equals":  return query.neq(field, v);
      case "starts_with": return query.ilike(field, `${v}%`);
      case "ends_with":   return query.ilike(field, `%${v}`);
    }
  }

  if (col.dataType === "imap_server" || col.dataType === "status") {
    const names = (row.value as string[]) ?? [];
    switch (row.operator) {
      case "is_any_of":
        return query.in(field, names);
      case "is_none_of": {
        // PostgREST "not in" syntax: .not(field, "in", "(val1,val2)")
        const formatted = `(${names.map((n) => `"${n.replace(/"/g, '\\"')}"`).join(",")})`;
        return query.not(field, "in", formatted);
      }
    }
  }

  if (col.dataType === "boolean") {
    switch (row.operator) {
      case "is_true":  return query.eq(field, true);
      case "is_false": return query.eq(field, false);
    }
  }

  if (col.dataType === "tags") {
    // Tags are stored as JSONB arrays of objects like
    //   [{"id":175,"name":"Outlook","default":true,...}]
    // We match by NAME using PostgreSQL JSONB containment (`@>`), which is
    // asymmetric: `cs.[{"name":"Outlook"}]` matches any row whose tags array
    // includes an object with that name (other fields in the stored object
    // are ignored).
    //
    // Limitation: in `has_any` we build a single `.or()` expression joined
    // by top-level commas, so tag names containing literal commas would
    // break the PostgREST parser. In practice tag names don't contain
    // commas (e.g. "Outlook", "Peeker December 12th").
    const names = (row.value as string[]) ?? [];
    let q = query;
    switch (row.operator) {
      case "has_all":
        for (const name of names) {
          q = q.contains(field, [{ name }]);
        }
        return q;
      case "has_any": {
        const clauses = names
          .map((name) => `${field}.cs.${JSON.stringify([{ name }])}`)
          .join(",");
        return q.or(clauses);
      }
      case "has_none":
        for (const name of names) {
          q = q.not(field, "cs", JSON.stringify([{ name }]));
        }
        return q;
    }
  }

  return query;
}

/**
 * Apply a set of parsed filters to a Supabase query. Caller must apply this
 * to BOTH the count query and the data query so pagination stays correct.
 *
 * Filters scoped to "domain-post" are skipped here — those are applied
 * post-aggregation in JS via applyFilters() from email-analyzer-filters.ts.
 */
export function applyFiltersToQuery(
  query: SbQuery,
  filters: ParsedFilters,
  columns: FilterColumn[],
): SbQuery {
  const serverRows = filters.rows.filter((r) => {
    const col = getColumnById(columns, r.columnId);
    return col && col.scope !== "domain-post";
  });
  if (serverRows.length === 0) return query;

  if (filters.conjunction === "and") {
    let q = query;
    for (const row of serverRows) {
      const col = getColumnById(columns, row.columnId)!;
      q = applyRowAnd(q, row, col);
    }
    return q;
  }

  // OR mode: build an `.or()` expression. Tag filters can't be safely
  // embedded in .or() grammar, so we split them out and chain separately —
  // which effectively ANDs them with the OR group. This is a known v1 limit.
  const orClauses: string[] = [];
  const tagRows: ParsedFilterRow[] = [];

  for (const row of serverRows) {
    const col = getColumnById(columns, row.columnId)!;
    if (col.dataType === "tags") {
      tagRows.push(row);
      continue;
    }
    orClauses.push(...rowToOrClauses(row, col));
  }

  let q = query;
  if (orClauses.length > 0) {
    q = q.or(orClauses.join(","));
  }
  for (const row of tagRows) {
    const col = getColumnById(columns, row.columnId)!;
    q = applyRowAnd(q, row, col);
  }
  return q;
}
