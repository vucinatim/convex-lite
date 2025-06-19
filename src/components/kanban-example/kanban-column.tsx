import { Button } from "@/components/ui/button";
import { TaskCard } from "./task-card";
import { TaskDialog } from "./task-dialog";
import { useMutation } from "@/hooks/use-convex-lite";
import { api } from "convex/_generated/api";
import { useDroppable } from "@dnd-kit/core";
import type { Column } from "./types";
import {
  SortableContext,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";

interface KanbanColumnProps {
  column: Column;
}

export function KanbanColumn({ column }: KanbanColumnProps) {
  const { mutate: deleteColumn } = useMutation(api.columns.deleteColumn);

  const { setNodeRef, isOver } = useDroppable({
    id: column._id,
    data: {
      type: "column",
      column,
    },
  });

  // Get task IDs for the SortableContext
  const taskIds = column.tasks?.map((task) => task._id) || [];

  return (
    <div
      className={`bg-zinc-800 rounded-md p-4 flex flex-col h-full min-w-[300px] border ${
        isOver ? "border-primary border-2" : "border-zinc-700"
      }`}
    >
      <div className="flex items-center justify-between mb-3 pb-2">
        <h2 className="font-semibold text-zinc-100">{column.name}</h2>
        <Button
          size="icon"
          variant="ghost"
          className="h-8 w-8 text-zinc-400 hover:text-red-400"
          onClick={() => deleteColumn({ id: column._id })}
        >
          <span className="sr-only">Delete column</span>
          🗑️
        </Button>
      </div>

      <div
        ref={setNodeRef}
        className="flex-1 overflow-y-auto space-y-2 mb-2 pr-1"
      >
        <SortableContext items={taskIds} strategy={verticalListSortingStrategy}>
          {column.tasks?.map((task) => <TaskCard key={task._id} task={task} />)}
        </SortableContext>
      </div>

      <div className="mt-auto pt-2">
        <TaskDialog columnId={column._id} />
      </div>
    </div>
  );
}
