import { Button } from "@/components/ui/button";
import { ColumnDialog } from "@/components/kanban-example/column-dialog";
import { KanbanColumn } from "@/components/kanban-example/kanban-column";
import { useMutation, useQuery } from "@/hooks/use-convex-lite";
import { createFileRoute } from "@tanstack/react-router";
import { api } from "convex/_generated/api";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import type { DragEndEvent, DragStartEvent } from "@dnd-kit/core";
import { useState } from "react";
import { TaskCard } from "@/components/kanban-example/task-card";
import type { Task } from "@/components/kanban-example/types";

export const Route = createFileRoute("/kanban")({
  component: KanbanPage,
});

function KanbanPage() {
  const {
    data: columns,
    // isLoading,
    error,
  } = useQuery(api.columns.getAllColumnsWithTasks);
  const { mutate: moveTask } = useMutation(api.tasks.moveTask);

  const [activeTask, setActiveTask] = useState<Task | null>(null);

  // Configure sensors for drag and drop
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // 8px movement before drag starts
      },
    })
  );

  // Handle drag start
  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    const task = active.data.current?.task;

    if (task) {
      setActiveTask(task);
    }
  };

  // Handle drag end
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const taskId = active.id as string;
      const newColumnId = over.id as string;
      const task = active.data.current?.task as Task;

      if (task && task.columnId !== newColumnId) {
        // Call the mutation to update the task's column
        moveTask({
          id: taskId,
          columnId: newColumnId,
        });
      }
    }

    // Reset active task
    setActiveTask(null);
  };

  // We can use this to show a loading state, but since data is almost instantly available, it's almost always just an unnecessary flash
  //   if (isLoading) {
  //     return (
  //       <div className="flex items-center justify-center h-[calc(100vh-4rem)]">
  //         <div className="text-center">
  //           <h2 className="text-xl font-medium mb-2">Loading Kanban Board...</h2>
  //           <p className="text-zinc-500">Please wait while we fetch your data</p>
  //         </div>
  //       </div>
  //     );
  //   }

  if (error) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-4rem)]">
        <div className="text-center">
          <h2 className="text-xl font-medium mb-2 text-red-500">
            Error Loading Data
          </h2>
          <p className="text-zinc-500">
            {error.message || "An unknown error occurred"}
          </p>
          <Button className="mt-4">Retry</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="relative p-6 h-[calc(100vh-10rem)] flex flex-col overflow-hidden">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold tracking-tight">Kanban Board</h1>
        <div className="flex items-center gap-2">
          <ColumnDialog />
        </div>
      </div>

      {columns && columns.length > 0 ? (
        <DndContext
          sensors={sensors}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <div className="flex -mx-6 px-6 flex-row pb-4 gap-x-4 h-full overflow-x-auto">
            {columns.map((column) => (
              <KanbanColumn key={column._id} column={column} />
            ))}
          </div>

          {/* Drag overlay shows a preview of the dragged item */}
          <DragOverlay>
            {activeTask ? (
              <div className="w-[300px]">
                <TaskCard task={activeTask} />
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      ) : (
        <div className="flex flex-col items-center justify-center h-full">
          <div className="text-center">
            <h2 className="text-xl font-medium mb-2">No Columns Yet</h2>
            <p className="text-zinc-500 mb-4">
              Get started by creating your first column
            </p>
            <ColumnDialog
              trigger={<Button size="lg">Create Your First Column</Button>}
            />
          </div>
        </div>
      )}
    </div>
  );
}
