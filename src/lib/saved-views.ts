// LocalStorage-backed saved views for the Email Analyzer.
// Follows the try/catch wrapper style of src/lib/settings.ts.

import type { FilterState } from "@/lib/email-analyzer-filters";

export type SavedViewScope = "email" | "domain";

export interface SavedView {
  id: string;
  name: string;
  scope: SavedViewScope;
  filters: FilterState;
  createdAt: string;
}

const KEY = "uparrow:email-analyzer-views";

function readAll(): SavedView[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed as SavedView[];
  } catch {
    return [];
  }
}

function writeAll(views: SavedView[]): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(views));
  } catch {
    // localStorage can be unavailable (SSR, privacy mode) — silently ignore.
  }
}

export function listViews(scope: SavedViewScope): SavedView[] {
  return readAll().filter((v) => v.scope === scope);
}

export function getView(id: string): SavedView | null {
  return readAll().find((v) => v.id === id) ?? null;
}

export function createView(
  scope: SavedViewScope,
  name: string,
  filters: FilterState,
): SavedView {
  const view: SavedView = {
    id: `v_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
    name,
    scope,
    filters,
    createdAt: new Date().toISOString(),
  };
  const all = readAll();
  all.push(view);
  writeAll(all);
  return view;
}

export function updateView(id: string, patch: Partial<Pick<SavedView, "name" | "filters">>): void {
  const all = readAll();
  const idx = all.findIndex((v) => v.id === id);
  if (idx < 0) return;
  all[idx] = { ...all[idx], ...patch };
  writeAll(all);
}

export function deleteView(id: string): void {
  writeAll(readAll().filter((v) => v.id !== id));
}

// ---------- Custom tag values ----------
// User-typed tag names that aren't in the known tag list from the API.
// Persisted across sessions so the user's personal list of quick-filter
// values grows over time. Shared across all saved views.

const CUSTOM_TAGS_KEY = "uparrow:email-analyzer-custom-tag-values";

export function listCustomTagValues(): string[] {
  try {
    const raw = localStorage.getItem(CUSTOM_TAGS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((s): s is string => typeof s === "string");
  } catch {
    return [];
  }
}

function writeCustomTagValues(values: string[]): void {
  try {
    localStorage.setItem(CUSTOM_TAGS_KEY, JSON.stringify(values));
  } catch {
    // localStorage unavailable — silently ignore.
  }
}

export function addCustomTagValue(name: string): void {
  const trimmed = name.trim();
  if (!trimmed) return;
  const current = listCustomTagValues();
  if (current.includes(trimmed)) return;
  writeCustomTagValues([...current, trimmed]);
}

export function removeCustomTagValue(name: string): void {
  writeCustomTagValues(listCustomTagValues().filter((n) => n !== name));
}

// Compare two filter states structurally — used to detect "dirty" state.
export function filtersEqual(a: FilterState, b: FilterState): boolean {
  if (a.conjunction !== b.conjunction) return false;
  if (a.rows.length !== b.rows.length) return false;
  for (let i = 0; i < a.rows.length; i++) {
    const x = a.rows[i];
    const y = b.rows[i];
    if (x.columnId !== y.columnId) return false;
    if (x.operator !== y.operator) return false;
    if (JSON.stringify(x.value) !== JSON.stringify(y.value)) return false;
  }
  return true;
}
