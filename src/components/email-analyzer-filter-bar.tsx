"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Filter, Plus, X, Check } from "lucide-react";
import {
  defaultValueForOperator,
  getColumnById,
  getOperatorDef,
  getOperatorsForType,
  isFilterRowComplete,
  isMultiValueStringOp,
  newFilterRow,
  type FilterColumn,
  type FilterRow,
  type FilterState,
} from "@/lib/email-analyzer-filters";
import {
  addCustomTagValue,
  listCustomTagValues,
  removeCustomTagValue,
} from "@/lib/saved-views";
import type { Tag } from "@/lib/data";

interface Props {
  columns: FilterColumn[];
  tags: Tag[];
  state: FilterState;
  onChange(next: FilterState): void;
}

export function EmailAnalyzerFilterBar({ columns, tags, state, onChange }: Props) {
  const [open, setOpen] = useState(false);
  // Local draft — edits stay here until Apply is clicked.
  const [draft, setDraft] = useState<FilterState>(
    state.rows.length > 0 ? state : { ...state, rows: [newFilterRow(columns)] }
  );

  // Sync draft from parent whenever the popover is closed (e.g. saved view loaded externally).
  useEffect(() => {
    if (!open) {
      setDraft(state.rows.length > 0 ? state : { ...state, rows: [newFilterRow(columns)] });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, state]);

  // Badge on trigger shows currently *applied* filter count (from state prop).
  const appliedCount = useMemo(
    () => state.rows.filter((r) => isFilterRowComplete(r, columns)).length,
    [state.rows, columns],
  );

  // Header inside the panel shows the draft count so the user sees live feedback.
  const draftCompleteCount = useMemo(
    () => draft.rows.filter((r) => isFilterRowComplete(r, columns)).length,
    [draft.rows, columns],
  );

  function updateRow(rowId: string, patch: Partial<FilterRow>) {
    setDraft((d) => ({
      ...d,
      rows: d.rows.map((r) => (r.id === rowId ? { ...r, ...patch } : r)),
    }));
  }

  function removeRow(rowId: string) {
    setDraft((d) => {
      const next = d.rows.filter((r) => r.id !== rowId);
      return { ...d, rows: next.length === 0 ? [newFilterRow(columns)] : next };
    });
  }

  function addRow() {
    setDraft((d) => ({ ...d, rows: [...d.rows, newFilterRow(columns)] }));
  }

  function clearAll() {
    const cleared = { conjunction: draft.conjunction, rows: [newFilterRow(columns)] };
    setDraft(cleared);
    onChange(cleared);
    setOpen(false);
  }

  function setConjunction(c: "and" | "or") {
    setDraft((d) => ({ ...d, conjunction: c }));
  }

  function apply() {
    onChange(draft);
    setOpen(false);
  }

  // Discard uncommitted changes when the popover closes without Apply.
  function handleOpenChange(next: boolean) {
    setOpen(next);
  }

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <Popover open={open} onOpenChange={handleOpenChange}>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className="h-9 gap-1.5">
            <Filter className="size-3.5" />
            Filter
            {appliedCount > 0 && (
              <Badge variant="secondary" className="h-5 min-w-5 px-1.5 text-[10px] ml-0.5">
                {appliedCount}
              </Badge>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-170 p-0">
          <div className="border-b px-3 py-2 text-xs font-medium text-muted-foreground">
            {draftCompleteCount === 0
              ? "No filters"
              : `Filter where${draftCompleteCount > 1 ? ` ${draft.conjunction.toUpperCase()} of` : ""} the following`}
          </div>

          <div className="max-h-90 overflow-y-auto p-3 space-y-2">
            {draft.rows.map((row, i) => (
              <div key={row.id} className="flex items-center gap-1.5">
                {/* Conjunction label */}
                <div className="w-16 shrink-0">
                  {i === 0 ? (
                    <span className="text-xs text-muted-foreground pl-2">Where</span>
                  ) : i === 1 ? (
                    <Select
                      value={draft.conjunction}
                      onValueChange={(v) => setConjunction(v as "and" | "or")}
                    >
                      <SelectTrigger className="h-8 w-16 text-xs px-2">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="and">and</SelectItem>
                        <SelectItem value="or">or</SelectItem>
                      </SelectContent>
                    </Select>
                  ) : (
                    <span className="text-xs text-muted-foreground pl-2">{draft.conjunction}</span>
                  )}
                </div>

                <FilterRowEditor
                  row={row}
                  columns={columns}
                  tags={tags}
                  onChange={(patch) => updateRow(row.id, patch)}
                />

                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0 shrink-0"
                  onClick={() => removeRow(row.id)}
                  aria-label="Remove filter"
                >
                  <X className="size-3.5" />
                </Button>
              </div>
            ))}
          </div>

          <div className="border-t px-3 py-2 flex items-center justify-between">
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={addRow}>
                <Plus className="size-3.5 mr-1" />
                Add filter
              </Button>
              {(draftCompleteCount > 0 || draft.rows.length > 1) && (
                <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={clearAll}>
                  Clear all
                </Button>
              )}
            </div>
            <Button size="sm" className="h-8 text-xs px-3" onClick={apply}>
              Apply
            </Button>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}

// ---------- Row editor ----------

interface RowEditorProps {
  row: FilterRow;
  columns: FilterColumn[];
  tags: Tag[];
  onChange(patch: Partial<FilterRow>): void;
}

function FilterRowEditor({ row, columns, tags, onChange }: RowEditorProps) {
  const col = getColumnById(columns, row.columnId) ?? columns[0];
  const ops = getOperatorsForType(col.dataType);
  const opDef = getOperatorDef(col.dataType, row.operator) ?? ops[0];

  function handleColumnChange(nextId: string) {
    const nextCol = getColumnById(columns, nextId);
    if (!nextCol) return;
    // Reset operator + value when switching column type
    const nextOp = getOperatorsForType(nextCol.dataType)[0];
    onChange({
      columnId: nextId,
      operator: nextOp.id,
      value: defaultValueForOperator(nextCol, nextOp),
    });
  }

  function handleOperatorChange(nextOpId: string) {
    const nextOp = getOperatorDef(col.dataType, nextOpId);
    if (!nextOp) return;
    // Decide if the existing value shape is compatible with the new operator.
    // If not, reset to the operator's default shape.
    const prevMulti = isMultiValueStringOp(row.operator);
    const nextMulti = isMultiValueStringOp(nextOpId);
    let value: FilterRow["value"] = row.value;
    if (!nextOp.hasInput) {
      value = null;
    } else if (nextOp.isRange) {
      value = Array.isArray(row.value) && row.value.length === 2 && typeof row.value[0] === "number"
        ? row.value
        : [0, 0];
    } else if (opDef.isRange && !nextOp.isRange) {
      value = defaultValueForOperator(col, nextOp);
    } else if (prevMulti !== nextMulti) {
      // Entering or leaving multi-value string mode — reshape.
      value = defaultValueForOperator(col, nextOp);
    }
    onChange({ operator: nextOpId, value });
  }

  return (
    <>
      {/* Column select */}
      <Select value={row.columnId} onValueChange={handleColumnChange}>
        <SelectTrigger className="h-8 w-36 shrink-0 text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {columns.map((c) => (
            <SelectItem key={c.id} value={c.id} className="text-xs">
              {c.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Operator select */}
      <Select value={row.operator} onValueChange={handleOperatorChange}>
        <SelectTrigger className="h-8 w-32 shrink-0 text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {ops.map((o) => (
            <SelectItem key={o.id} value={o.id} className="text-xs">
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Value input */}
      <div className="flex-1 min-w-0 overflow-hidden">
        <ValueInput row={row} col={col} opDef={opDef} tags={tags} onChange={onChange} />
      </div>
    </>
  );
}

// ---------- Value input ----------

interface ValueInputProps {
  row: FilterRow;
  col: FilterColumn;
  opDef: { id: string; hasInput: boolean; isRange?: boolean };
  tags: Tag[];
  onChange(patch: Partial<FilterRow>): void;
}

function ValueInput({ row, col, opDef, tags, onChange }: ValueInputProps) {
  if (!opDef.hasInput) {
    return <div className="text-xs text-muted-foreground italic px-2">—</div>;
  }

  if (opDef.isRange) {
    const v = Array.isArray(row.value) ? row.value : [0, 0];
    return (
      <div className="flex items-center gap-1">
        <Input
          type="number"
          value={v[0]}
          onChange={(e) => onChange({ value: [Number(e.target.value), v[1] as number] })}
          className="h-8 text-xs"
          placeholder="min"
        />
        <span className="text-xs text-muted-foreground">–</span>
        <Input
          type="number"
          value={v[1]}
          onChange={(e) => onChange({ value: [v[0] as number, Number(e.target.value)] })}
          className="h-8 text-xs"
          placeholder="max"
        />
      </div>
    );
  }

  if (col.dataType === "number") {
    return (
      <Input
        type="number"
        value={typeof row.value === "number" ? row.value : ""}
        onChange={(e) =>
          onChange({ value: e.target.value === "" ? 0 : Number(e.target.value) })
        }
        className="h-8 text-xs"
        placeholder="Value"
      />
    );
  }

  if (col.dataType === "tags") {
    return <TagMultiPicker tags={tags} value={(row.value as string[]) ?? []} onChange={(v) => onChange({ value: v })} />;
  }

  // String: multi-value chip input for contains / not_contains, plain input otherwise.
  if (isMultiValueStringOp(opDef.id)) {
    const vals = Array.isArray(row.value) ? (row.value as string[]) : [];
    return <StringMultiInput value={vals} onChange={(v) => onChange({ value: v })} />;
  }

  return (
    <Input
      type="text"
      value={typeof row.value === "string" ? row.value : ""}
      onChange={(e) => onChange({ value: e.target.value })}
      className="h-8 text-xs"
      placeholder="Value"
    />
  );
}

// ---------- String multi-value chip input ----------

interface StringMultiInputProps {
  value: string[];
  onChange(next: string[]): void;
}

function StringMultiInput({ value, onChange }: StringMultiInputProps) {
  const [draft, setDraft] = useState("");

  function commitDraft() {
    const v = draft.trim();
    if (!v) return;
    if (value.includes(v)) {
      setDraft("");
      return;
    }
    onChange([...value, v]);
    setDraft("");
  }

  function removeChip(idx: number) {
    onChange(value.filter((_, i) => i !== idx));
  }

  return (
    <div className="flex w-full flex-wrap items-center gap-1 overflow-hidden rounded-md border border-input bg-transparent px-1.5 py-1 min-h-8 focus-within:border-ring">
      {value.map((v, i) => (
        <span
          key={`${v}-${i}`}
          className="inline-flex max-w-full min-w-0 items-center gap-1 rounded-sm bg-muted px-1.5 py-0.5 text-xs"
        >
          <button
            type="button"
            onClick={() => removeChip(i)}
            className="shrink-0 text-muted-foreground hover:text-foreground"
            aria-label={`Remove ${v}`}
          >
            <X className="size-3" />
          </button>
          <span className="truncate">{v}</span>
        </span>
      ))}
      <input
        type="text"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === ",") {
            e.preventDefault();
            commitDraft();
          } else if (e.key === "Backspace" && draft === "" && value.length > 0) {
            removeChip(value.length - 1);
          }
        }}
        onBlur={commitDraft}
        className="flex-1 min-w-16 bg-transparent text-xs outline-none"
        placeholder={value.length === 0 ? "Type value, press Enter" : ""}
      />
    </div>
  );
}

// ---------- Tag multi-picker ----------

interface TagPickerProps {
  tags: Tag[];
  value: string[];
  onChange(next: string[]): void;
}

function TagMultiPicker({ tags, value, onChange }: TagPickerProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  // version bumps after add/remove to re-read localStorage via useMemo,
  // avoiding the `react-hooks/set-state-in-effect` lint rule.
  const [version, setVersion] = useState(0);

  const customValues = useMemo(
    () => listCustomTagValues(),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [version],
  );

  // Dedupe API names: the tags endpoint can return multiple rows with the
  // same name (different ids / workspaces). Since filtering matches by name,
  // we only need each name once.
  const apiNames = useMemo(() => {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const t of tags) {
      if (!t.name || seen.has(t.name)) continue;
      seen.add(t.name);
      out.push(t.name);
    }
    return out;
  }, [tags]);

  // All options: API names first, then custom names not already in the API list.
  const allOptions = useMemo(() => {
    const apiSet = new Set(apiNames);
    const customNew = customValues.filter((n) => !apiSet.has(n));
    return [...apiNames, ...customNew];
  }, [apiNames, customValues]);

  const customSet = useMemo(() => {
    const apiSet = new Set(apiNames);
    return new Set(customValues.filter((n) => !apiSet.has(n)));
  }, [apiNames, customValues]);

  const selected = useMemo(() => new Set(value), [value]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return allOptions;
    return allOptions.filter((n) => n.toLowerCase().includes(q));
  }, [allOptions, search]);

  const hasExactMatch = useMemo(() => {
    const q = search.trim();
    if (!q) return false;
    const qLow = q.toLowerCase();
    return allOptions.some((n) => n.toLowerCase() === qLow);
  }, [allOptions, search]);

  function toggle(name: string) {
    const next = new Set(selected);
    if (next.has(name)) next.delete(name);
    else next.add(name);
    onChange([...next]);
  }

  function addCustom() {
    const trimmed = search.trim();
    if (!trimmed) return;
    addCustomTagValue(trimmed);
    const next = new Set(selected);
    next.add(trimmed);
    onChange([...next]);
    setSearch("");
    setVersion((v) => v + 1);
  }

  function deleteCustom(name: string) {
    removeCustomTagValue(name);
    setVersion((v) => v + 1);
  }

  const label =
    value.length === 0
      ? "Select tags…"
      : value.length === 1
      ? value[0]
      : `${value.length} tags`;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="h-8 w-full justify-start text-xs font-normal">
          <span className="truncate">{label}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-64 p-0">
        <div className="p-2 border-b">
          <Input
            placeholder="Search or add tag..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                if (!hasExactMatch) addCustom();
              }
            }}
            className="h-8 text-sm"
          />
        </div>
        <div className="max-h-60 overflow-y-auto p-1">
          {filtered.length === 0 && !search.trim() && (
            <p className="text-xs text-muted-foreground text-center py-3">No tags</p>
          )}
          {filtered.map((name) => {
            const isCustom = customSet.has(name);
            return (
              <div key={name} className="group flex items-center">
                <button
                  type="button"
                  className="flex flex-1 items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-muted/50 cursor-pointer text-left min-w-0"
                  onClick={() => toggle(name)}
                >
                  <Check className={`size-3.5 shrink-0 ${selected.has(name) ? "opacity-100" : "opacity-0"}`} />
                  <span className="truncate flex-1">{name}</span>
                  {isCustom && (
                    <span className="text-[10px] text-muted-foreground shrink-0">custom</span>
                  )}
                </button>
                {isCustom && (
                  <button
                    type="button"
                    className="shrink-0 px-1.5 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive"
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteCustom(name);
                    }}
                    aria-label={`Delete custom tag ${name}`}
                  >
                    <X className="size-3" />
                  </button>
                )}
              </div>
            );
          })}
          {search.trim() && !hasExactMatch && (
            <button
              type="button"
              className="mt-1 flex w-full items-center gap-2 rounded-sm border-t px-2 py-1.5 text-sm hover:bg-muted/50 cursor-pointer"
              onClick={addCustom}
            >
              <Plus className="size-3.5" />
              <span className="truncate">Add &quot;{search.trim()}&quot;</span>
            </button>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
