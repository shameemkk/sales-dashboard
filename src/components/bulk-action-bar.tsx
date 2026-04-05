"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { X, Loader2, Plus, Minus } from "lucide-react";
import type { Tag } from "@/lib/data";

interface Props {
  selectedCount: number;
  selectedSenderIds: string[];
  tags: Tag[];
  existingTags: Tag[];
  onClearSelection: () => void;
  onTagsUpdated: () => void;
}

export function BulkActionBar({
  selectedCount,
  selectedSenderIds,
  tags,
  existingTags,
  onClearSelection,
  onTagsUpdated,
}: Props) {
  const [addOpen, setAddOpen] = useState(false);
  const [removeOpen, setRemoveOpen] = useState(false);
  const [selectedTagIds, setSelectedTagIds] = useState<Set<number>>(new Set());
  const [submitting, setSubmitting] = useState(false);

  function toggleTag(id: number) {
    setSelectedTagIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleAddTags() {
    if (selectedTagIds.size === 0) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/email-analyzer/tags", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          senderIds: selectedSenderIds,
          tagIds: [...selectedTagIds],
        }),
      });
      if (res.ok) {
        onTagsUpdated();
        setAddOpen(false);
        setSelectedTagIds(new Set());
      }
    } catch (err) {
      console.error("Failed to add tags:", err);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleRemoveTags() {
    if (selectedTagIds.size === 0) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/email-analyzer/tags", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          senderIds: selectedSenderIds,
          tagIds: [...selectedTagIds],
        }),
      });
      if (res.ok) {
        onTagsUpdated();
        setRemoveOpen(false);
        setSelectedTagIds(new Set());
      }
    } catch (err) {
      console.error("Failed to remove tags:", err);
    } finally {
      setSubmitting(false);
    }
  }

  if (selectedCount === 0) return null;

  return (
    <>
      {/* Floating action bar */}
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50">
        <div className="flex items-center gap-3 rounded-lg border bg-background/95 backdrop-blur-sm shadow-lg px-4 py-2.5">
          <Button
            variant="ghost"
            size="icon"
            className="size-7"
            onClick={onClearSelection}
          >
            <X className="size-4" />
          </Button>
          <span className="text-sm font-medium whitespace-nowrap">
            {selectedCount} email account{selectedCount !== 1 ? "s" : ""} selected
          </span>
          <div className="h-4 w-px bg-border" />
          <Button
            variant="default"
            size="sm"
            onClick={() => { setSelectedTagIds(new Set()); setAddOpen(true); }}
          >
            <Plus className="size-3.5 mr-1.5" />
            Add Tags
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => { setSelectedTagIds(new Set()); setRemoveOpen(true); }}
          >
            <Minus className="size-3.5 mr-1.5" />
            Remove Tags
          </Button>
        </div>
      </div>

      {/* Add Tags Dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add Tags to {selectedCount} Email{selectedCount !== 1 ? "s" : ""}</DialogTitle>
          </DialogHeader>
          <div className="max-h-64 overflow-y-auto space-y-2 py-2">
            {tags.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">No tags available</p>
            ) : (
              tags.map((tag) => (
                <label
                  key={tag.id}
                  className="flex items-center gap-3 rounded-md px-3 py-2 hover:bg-muted/50 cursor-pointer"
                >
                  <Checkbox
                    checked={selectedTagIds.has(tag.id)}
                    onCheckedChange={() => toggleTag(tag.id)}
                  />
                  <Badge variant="secondary">{tag.name}</Badge>
                </label>
              ))
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>Cancel</Button>
            <Button onClick={handleAddTags} disabled={selectedTagIds.size === 0 || submitting}>
              {submitting && <Loader2 className="size-3.5 mr-1.5 animate-spin" />}
              Add {selectedTagIds.size > 0 ? `(${selectedTagIds.size})` : ""}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Remove Tags Dialog — only shows tags that exist on selected emails */}
      <Dialog open={removeOpen} onOpenChange={setRemoveOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Remove Tags from {selectedCount} Email{selectedCount !== 1 ? "s" : ""}</DialogTitle>
          </DialogHeader>
          <div className="max-h-64 overflow-y-auto space-y-2 py-2">
            {existingTags.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">No tags on selected emails</p>
            ) : (
              existingTags.map((tag) => (
                <label
                  key={tag.id}
                  className="flex items-center gap-3 rounded-md px-3 py-2 hover:bg-muted/50 cursor-pointer"
                >
                  <Checkbox
                    checked={selectedTagIds.has(tag.id)}
                    onCheckedChange={() => toggleTag(tag.id)}
                  />
                  <Badge variant="secondary">{tag.name}</Badge>
                </label>
              ))
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRemoveOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={handleRemoveTags} disabled={selectedTagIds.size === 0 || submitting}>
              {submitting && <Loader2 className="size-3.5 mr-1.5 animate-spin" />}
              Remove {selectedTagIds.size > 0 ? `(${selectedTagIds.size})` : ""}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
