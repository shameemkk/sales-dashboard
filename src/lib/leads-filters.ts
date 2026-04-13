// Leads page — filter column definitions, client-side filter application,
// and tag-filter serialization for server-side stats computation.

import {
  applyFilters,
  isFilterRowComplete,
  serializeFilters,
  type FilterColumn,
  type FilterState,
  type ParsedFilters,
} from "@/lib/email-analyzer-filters";
import type { Lead } from "@/lib/data";

// Filter columns available in the Leads filter builder.
export const LEADS_COLUMNS: FilterColumn[] = [
  { id: "tags",        label: "Tags",              field: "tags",        dataType: "tags",   scope: "email" },
  { id: "email",       label: "Email",             field: "email",       dataType: "string", scope: "email" },
  { id: "companyName", label: "Company",           field: "companyName", dataType: "string", scope: "email" },
  { id: "phone",       label: "Phone",             field: "phone",       dataType: "string", scope: "email" },
  // Virtual numeric columns — computed from timestamps in applyLeadsFilters.
  // Values are in minutes; undefined (NaN in Number()) when the event hasn't occurred.
  // is_empty  → lead has NOT been dialed / texted
  // is_not_empty → lead HAS been dialed / texted
  // numeric ops (>, <=, between, …) → filter by response duration
  { id: "dialSpeed",   label: "Time to Dial (min)", field: "dialSpeed",   dataType: "number", scope: "email" },
  { id: "textSpeed",   label: "Time to Text (min)", field: "textSpeed",   dataType: "number", scope: "email" },
];

// Returns elapsed minutes between two ISO timestamps, or undefined if either is missing.
// undefined rather than null so Number(undefined) = NaN, making numeric filter
// predicates correctly return false for leads that haven't been dialed/texted.
function elapsedMinutes(from: string | null, to: string | null): number | undefined {
  if (!from || !to) return undefined;
  const diff = new Date(to).getTime() - new Date(from).getTime();
  if (diff < 0) return undefined;
  return Math.round(diff / 60000);
}

// Apply a parsed filter set to a leads array (client-side display).
// - Normalises string[] tags → {name:string}[] for the shared evaluateRow.
// - Adds virtual dialSpeed / textSpeed (minutes) fields for numeric filtering.
// Results are mapped back to original Lead objects by id.
export function applyLeadsFilters(leads: Lead[], filters: ParsedFilters): Lead[] {
  if (filters.rows.length === 0) return leads;
  const normalized = leads.map((l) => ({
    ...l,
    tags: l.tags.map((t) => ({ name: t })),
    dialSpeed: elapsedMinutes(l.dateAdded, l.firstDialTime),
    textSpeed: elapsedMinutes(l.dateAdded, l.firstTextTime),
  })) as unknown as Record<string, unknown>[];
  const kept = new Set(
    applyFilters(normalized, filters, LEADS_COLUMNS).map((r) => (r as { id: string }).id),
  );
  return leads.filter((l) => kept.has(l.id));
}

// Server-side column IDs — these filter rows are sent to the API.
// tags: applied via Supabase array operators
// dialSpeed / textSpeed: applied server-side by computing elapsed minutes from timestamps
const SERVER_COLUMN_IDS = new Set(["tags", "dialSpeed", "textSpeed"]);

// Serialize filter rows that can be applied server-side (tags + speed columns).
// Other columns (email, company, phone) stay client-side only.
export function serializeTagFilters(state: FilterState): URLSearchParams {
  const serverRows = state.rows.filter(
    (r) => SERVER_COLUMN_IDS.has(r.columnId) && isFilterRowComplete(r, LEADS_COLUMNS),
  );
  if (serverRows.length === 0) return new URLSearchParams();
  return serializeFilters({ conjunction: state.conjunction, rows: serverRows }, LEADS_COLUMNS);
}

// Convert a FilterState into the ParsedFilters shape expected by applyLeadsFilters.
// Skips incomplete rows (no column, no operator, or missing value).
export function parsedFromState(state: FilterState): ParsedFilters {
  return {
    conjunction: state.conjunction,
    rows: state.rows
      .filter((r) => isFilterRowComplete(r, LEADS_COLUMNS))
      .map(({ columnId, operator, value }) => ({ columnId, operator, value })),
  };
}
