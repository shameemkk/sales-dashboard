"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Bookmark, BookmarkPlus, Check, ChevronDown, RotateCcw, Save, Trash2 } from "lucide-react";
import {
  createView,
  deleteView,
  filtersEqual,
  getView,
  listViews,
  updateView,
  type SavedViewScope,
} from "@/lib/saved-views";
import type { FilterState } from "@/lib/email-analyzer-filters";

interface Props {
  scope: SavedViewScope;
  activeViewId: string | null;
  currentFilters: FilterState;
  onActivate(id: string | null, filters: FilterState): void;
  onApplyFilters(next: FilterState): void;
}

export function EmailAnalyzerViews({
  scope,
  activeViewId,
  currentFilters,
  onActivate,
  onApplyFilters,
}: Props) {
  // `version` is bumped after every mutation (create/update/delete) so the
  // memoized view list re-reads localStorage. Avoids a useEffect entirely
  // and keeps the render pure.
  const [version, setVersion] = useState(0);
  const [saveOpen, setSaveOpen] = useState(false);
  const [newName, setNewName] = useState("");

  // `version` IS a dependency here — bumping it is how we re-read localStorage
  // after a mutation. The lint rule doesn't recognize that pattern.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const views = useMemo(() => listViews(scope), [scope, version]);
  const refresh = () => setVersion((v) => v + 1);

  const activeView = activeViewId ? views.find((v) => v.id === activeViewId) ?? null : null;
  const isDirty = activeView ? !filtersEqual(activeView.filters, currentFilters) : false;
  const defaultLabel = scope === "email" ? "All emails" : "All domains";

  function handleActivate(id: string | null) {
    if (!id) {
      onActivate(null, { conjunction: "and", rows: [] });
      return;
    }
    const v = getView(id);
    if (v) onActivate(id, v.filters);
  }

  function handleSaveAsNew() {
    setNewName("");
    setSaveOpen(true);
  }

  function confirmSaveAsNew() {
    const name = newName.trim();
    if (!name) return;
    const view = createView(scope, name, currentFilters);
    refresh();
    onActivate(view.id, view.filters);
    setSaveOpen(false);
  }

  function handleSaveChanges() {
    if (!activeView) return;
    updateView(activeView.id, { filters: currentFilters });
    refresh();
  }

  function handleReset() {
    if (!activeView) return;
    onApplyFilters(activeView.filters);
  }

  function handleDelete() {
    if (!activeView) return;
    if (!confirm(`Delete view "${activeView.name}"?`)) return;
    deleteView(activeView.id);
    refresh();
    onActivate(null, { conjunction: "and", rows: [] });
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className="h-9 gap-1.5">
            <Bookmark className="size-3.5" />
            <span className="max-w-35 truncate">
              {activeView ? activeView.name : defaultLabel}
            </span>
            {isDirty && (
              <span
                className="size-1.5 rounded-full bg-orange-500"
                aria-label="Unsaved changes"
                title="Unsaved changes"
              />
            )}
            <ChevronDown className="size-3.5 opacity-50" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-56">
          <DropdownMenuLabel className="text-xs text-muted-foreground">
            Saved views
          </DropdownMenuLabel>

          <DropdownMenuItem
            className="text-xs"
            onSelect={() => handleActivate(null)}
          >
            <Check className={`size-3.5 ${activeViewId === null ? "opacity-100" : "opacity-0"}`} />
            {defaultLabel}
          </DropdownMenuItem>

          {views.length > 0 && <DropdownMenuSeparator />}
          {views.map((v) => (
            <DropdownMenuItem
              key={v.id}
              className="text-xs"
              onSelect={() => handleActivate(v.id)}
            >
              <Check className={`size-3.5 ${activeViewId === v.id ? "opacity-100" : "opacity-0"}`} />
              <span className="truncate">{v.name}</span>
            </DropdownMenuItem>
          ))}

          <DropdownMenuSeparator />

          {activeView && isDirty && (
            <DropdownMenuItem className="text-xs" onSelect={handleSaveChanges}>
              <Save className="size-3.5" />
              Save changes
            </DropdownMenuItem>
          )}
          {activeView && isDirty && (
            <DropdownMenuItem className="text-xs" onSelect={handleReset}>
              <RotateCcw className="size-3.5" />
              Reset to saved
            </DropdownMenuItem>
          )}
          <DropdownMenuItem className="text-xs" onSelect={handleSaveAsNew}>
            <BookmarkPlus className="size-3.5" />
            Save as new view…
          </DropdownMenuItem>
          {activeView && (
            <DropdownMenuItem
              className="text-xs text-destructive focus:text-destructive"
              onSelect={handleDelete}
            >
              <Trash2 className="size-3.5" />
              Delete view
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={saveOpen} onOpenChange={setSaveOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Save view</DialogTitle>
          </DialogHeader>
          <div className="py-2">
            <Input
              placeholder="View name"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter") confirmSaveAsNew();
              }}
            />
          </div>
          <DialogFooter>
            <Button variant="ghost" size="sm" onClick={() => setSaveOpen(false)}>
              Cancel
            </Button>
            <Button size="sm" onClick={confirmSaveAsNew} disabled={!newName.trim()}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
