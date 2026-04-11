"use client";

import { useState } from "react";
import { DndContext, DragEndEvent, DragStartEvent, useDraggable, useDroppable, DragOverlay } from "@dnd-kit/core";
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

function DraggableChip({ id, label, dragging }: { id: string; label: string; dragging: boolean }) {
  const { attributes, listeners, setNodeRef, transform } = useDraggable({ id });
  const style = transform ? { transform: `translate(${transform.x}px, ${transform.y}px)`, zIndex: 50 } : undefined;
  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className={cn(
        "px-3 py-1.5 rounded-full border-2 border-accent bg-accent/10 text-accent text-sm font-medium cursor-grab active:cursor-grabbing select-none transition-opacity",
        dragging && "opacity-40"
      )}
    >
      {label}
    </div>
  );
}

function DropZone({
  id, label, droppedItem, showResult, correct,
}: {
  id: string; label: string; droppedItem?: string; showResult: boolean; correct: boolean;
}) {
  const { isOver, setNodeRef } = useDroppable({ id });
  return (
    <div className={cn(
      "rounded-lg border-2 p-3 transition-colors",
      isOver ? "border-accent/60 bg-accent/5" : "border-border"
    )}>
      <p className="text-xs font-semibold text-text-muted mb-2 uppercase tracking-wide">{label}</p>
      <div
        ref={setNodeRef}
        className={cn(
          "min-h-9 rounded-md flex items-center justify-center border-2 border-dashed transition-colors",
          droppedItem
            ? showResult
              ? correct ? "border-success bg-success/5" : "border-danger bg-danger/5"
              : "border-accent/40 bg-accent/5"
            : "border-border/40 bg-bg-primary"
        )}
      >
        {droppedItem ? (
          <span className={cn(
            "text-sm font-medium flex items-center gap-1.5 px-2",
            showResult ? (correct ? "text-success" : "text-danger") : "text-accent"
          )}>
            {droppedItem}
            {showResult && (correct ? <CheckCircle className="h-3.5 w-3.5 shrink-0" /> : <XCircle className="h-3.5 w-3.5 shrink-0" />)}
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
  const [submitted, setSubmitted] = useState(false);
  const [allCorrect, setAllCorrect] = useState(false);

  const placedItems = new Set(Object.values(placements));
  const bankItems = items.filter(item => !placedItems.has(item));
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

    const newPlacements = { ...placements };
    // Remove from any existing target
    Object.keys(newPlacements).forEach(t => {
      if (newPlacements[t] === draggedItem) delete newPlacements[t];
    });
    // Swap out existing item in target (return it to bank)
    if (newPlacements[targetId]) delete newPlacements[targetId];
    newPlacements[targetId] = draggedItem;
    setPlacements(newPlacements);
  }

  function handleCheck() {
    const correct = correctPairs.every(p => placements[p.target] === p.item);
    setAllCorrect(correct);
    setSubmitted(true);
    onAnswer(correct);
  }

  if (disabled && !submitted) {
    return <p className="text-sm text-text-muted italic">Drag-and-drop question (quiz already submitted)</p>;
  }

  return (
    <DndContext onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="space-y-3">
        {/* Item bank */}
        {bankItems.length > 0 && (
          <div className="flex flex-wrap gap-2 p-3 rounded-lg border border-dashed border-border bg-bg-primary">
            <p className="text-xs text-text-muted w-full">Drag each item to its correct target:</p>
            {bankItems.map(item => (
              <DraggableChip key={item} id={item} label={item} dragging={activeId === item} />
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
              showResult={submitted}
              correct={submitted && placements[p.target] === p.item}
            />
          ))}
        </div>

        {!submitted && (
          <Button size="sm" variant="outline" onClick={handleCheck} disabled={!allPlaced}>
            Check Matches
          </Button>
        )}

        {submitted && (
          <p className={cn("text-sm font-medium", allCorrect ? "text-success" : "text-danger")}>
            {allCorrect
              ? "All matches correct!"
              : "Some matches are wrong — review the highlighted targets above."}
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
