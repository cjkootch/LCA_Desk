"use client";

import { useState } from "react";
import {
  DndContext, DragEndEvent, DragStartEvent,
  useDraggable, useDroppable, DragOverlay,
} from "@dnd-kit/core";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { CheckCircle, XCircle } from "lucide-react";

interface DragDropQuizProps {
  question: string;
  items: string[];
  correctPairs: { item: string; target: string }[];
  onAnswer: (isCorrect: boolean) => void;
  disabled?: boolean;
}

function DraggableChip({
  id, label, dragging, locked,
}: {
  id: string; label: string; dragging: boolean; locked: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform } = useDraggable({ id, disabled: locked });
  const style = transform ? { transform: `translate(${transform.x}px, ${transform.y}px)`, zIndex: 50 } : undefined;
  return (
    <div
      ref={setNodeRef}
      style={style}
      {...(locked ? {} : listeners)}
      {...(locked ? {} : attributes)}
      className={cn(
        "px-3 py-1.5 rounded-full border-2 text-sm font-medium select-none transition-opacity",
        locked
          ? "border-success/40 bg-success/10 text-success cursor-default"
          : "border-accent bg-accent/10 text-accent cursor-grab active:cursor-grabbing",
        dragging && "opacity-40"
      )}
    >
      {label}
    </div>
  );
}

function DropZone({
  id, label, droppedItem, checked, isConfirmed, isWrong,
}: {
  id: string; label: string; droppedItem?: string;
  checked: boolean; isConfirmed: boolean; isWrong: boolean;
}) {
  const { isOver, setNodeRef } = useDroppable({ id });
  const borderColor = isOver
    ? "border-accent/60 bg-accent/5"
    : "border-border";
  const chipBorder = droppedItem
    ? isConfirmed
      ? "border-success bg-success/5"
      : isWrong
      ? "border-danger bg-danger/5"
      : "border-accent/40 bg-accent/5"
    : "border-border/40 bg-bg-primary";
  const chipText = isConfirmed ? "text-success" : isWrong ? "text-danger" : "text-accent";

  return (
    <div className={cn("rounded-lg border-2 p-3 transition-colors", borderColor)}>
      <p className="text-xs font-semibold text-text-muted mb-2 uppercase tracking-wide">{label}</p>
      <div ref={setNodeRef} className={cn("min-h-9 rounded-md flex items-center justify-center border-2 border-dashed transition-colors", chipBorder)}>
        {droppedItem ? (
          <span className={cn("text-sm font-medium flex items-center gap-1.5 px-2", chipText)}>
            {droppedItem}
            {isConfirmed && <CheckCircle className="h-3.5 w-3.5 shrink-0" />}
            {isWrong && <XCircle className="h-3.5 w-3.5 shrink-0" />}
          </span>
        ) : (
          <span className="text-xs text-text-muted/40 italic">drop here</span>
        )}
      </div>
    </div>
  );
}

export function DragDropQuiz({ question, items, correctPairs, onAnswer, disabled }: DragDropQuizProps) {
  const targets = correctPairs.map(p => p.target);

  const [placements, setPlacements] = useState<Record<string, string>>({}); // target → item
  const [activeId, setActiveId] = useState<string | null>(null);
  const [checked, setChecked] = useState(false);        // whether results are currently shown
  const [confirmed, setConfirmed] = useState<Set<string>>(new Set()); // targets locked as correct
  const [allCorrect, setAllCorrect] = useState(false);

  // Items sitting in confirmed-correct targets are locked
  const lockedItems = new Set(
    Array.from(confirmed).map(t => placements[t]).filter(Boolean)
  );

  const placedItems = new Set(Object.values(placements));
  const bankItems = items.filter(item => !placedItems.has(item));
  // All slots filled (including confirmed ones) — enables "Check Answers"
  const allPlaced = bankItems.length === 0;

  function handleDragStart(e: DragStartEvent) {
    setActiveId(e.active.id as string);
  }

  function handleDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    setActiveId(null);
    if (!over) return;
    const draggedItem = active.id as string;
    const targetId = over.id as string;
    if (!targets.includes(targetId)) return;
    if (lockedItems.has(draggedItem)) return;  // can't move confirmed-correct items
    if (confirmed.has(targetId)) return;       // can't drop into a confirmed-correct slot

    const newPlacements = { ...placements };
    // Remove draggedItem from its current slot
    for (const t of Object.keys(newPlacements)) {
      if (newPlacements[t] === draggedItem) delete newPlacements[t];
    }
    // If target is occupied by a non-locked item, displace it back to bank
    if (newPlacements[targetId] && !lockedItems.has(newPlacements[targetId])) {
      delete newPlacements[targetId];
    }
    newPlacements[targetId] = draggedItem;
    setPlacements(newPlacements);
    setChecked(false); // clear result highlights whenever placement changes
  }

  function handleCheck() {
    const newConfirmed = new Set(confirmed);
    let allRight = true;
    for (const p of correctPairs) {
      if (placements[p.target] === p.item) {
        newConfirmed.add(p.target);
      } else {
        allRight = false;
      }
    }
    setConfirmed(newConfirmed);
    setChecked(true);
    onAnswer(allRight); // update parent with current result
    if (allRight) setAllCorrect(true);
  }

  // Disabled view (parent already submitted whole quiz)
  if (disabled && !allCorrect) {
    return <p className="text-sm text-text-muted italic">Drag-and-drop question (quiz already submitted)</p>;
  }

  return (
    <DndContext onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="space-y-3">
        {/* Item bank — show while items remain unplaced */}
        {bankItems.length > 0 && !allCorrect && (
          <div className="flex flex-wrap gap-2 p-3 rounded-lg border border-dashed border-border bg-bg-primary">
            <p className="text-xs text-text-muted w-full">Drag each item to its correct target:</p>
            {bankItems.map(item => (
              <DraggableChip
                key={item}
                id={item}
                label={item}
                dragging={activeId === item}
                locked={lockedItems.has(item)}
              />
            ))}
          </div>
        )}

        {/* Drop targets */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {correctPairs.map(p => (
            <DropZone
              key={p.target}
              id={p.target}
              label={p.target}
              droppedItem={placements[p.target]}
              checked={checked}
              isConfirmed={confirmed.has(p.target)}
              isWrong={checked && !!placements[p.target] && placements[p.target] !== p.item && !confirmed.has(p.target)}
            />
          ))}
        </div>

        {/* Action row */}
        {!allCorrect && (
          <div className="flex items-center gap-3">
            <Button
              size="sm"
              variant="outline"
              onClick={handleCheck}
              disabled={!allPlaced || checked}
            >
              Check Answers
            </Button>
            {checked && (
              <p className="text-sm text-danger font-medium">
                Some matches are wrong — move the red items to try again.
              </p>
            )}
          </div>
        )}

        {/* Success state */}
        {allCorrect && (
          <p className="text-sm text-success font-medium flex items-center gap-1.5">
            <CheckCircle className="h-4 w-4" /> All matches correct!
          </p>
        )}
      </div>

      <DragOverlay>
        {activeId ? (
          <div className="px-3 py-1.5 rounded-full border-2 border-accent bg-accent text-white text-sm font-medium shadow-xl cursor-grabbing">
            {activeId}
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
