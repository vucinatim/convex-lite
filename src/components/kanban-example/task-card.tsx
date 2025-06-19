import { Button } from "@/components/ui/button";
import { useMutation } from "@/hooks/use-convex-lite";
import { api } from "convex/_generated/api";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { Task } from "./types";
import { TaskDialog } from "./task-dialog";

interface TaskCardProps {
  task: Task;
}

export function TaskCard({ task }: TaskCardProps) {
  const { mutate: deleteTask } = useMutation(api.tasks.deleteTask);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: task._id,
    data: {
      type: "task",
      task,
    },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className="bg-white dark:bg-zinc-900 p-4 rounded-md shadow-sm border border-zinc-200 dark:border-zinc-700 hover:shadow-md transition-shadow cursor-grab active:cursor-grabbing"
    >
      <div className="flex justify-between items-start mb-2">
        <h3 className="font-medium text-zinc-900 dark:text-zinc-50">
          {task.title}
        </h3>
        <div className="flex space-x-1">
          <TaskDialog
            columnId={task.columnId}
            task={task}
            mode="edit"
            trigger={
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0 text-zinc-500 hover:text-blue-500"
              >
                <span className="sr-only">Edit</span>
                ✏️
              </Button>
            }
          />
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0 text-zinc-500 hover:text-red-500"
            onClick={() => deleteTask({ id: task._id })}
          >
            <span className="sr-only">Delete</span>
            🗑️
          </Button>
        </div>
      </div>
      {task.description && (
        <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
          {task.description}
        </p>
      )}
      <div className="flex justify-between items-center mt-4 pt-2 border-t border-zinc-100 dark:border-zinc-800">
        <span className="text-xs text-zinc-500">
          ID: {task._id.slice(0, 8)}...
        </span>
      </div>
    </div>
  );
}
