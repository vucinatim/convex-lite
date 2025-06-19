import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useMutation } from "@/hooks/use-convex-lite";
import { api } from "convex/_generated/api";
import type { Task } from "./types";

interface TaskDialogProps {
  columnId: string;
  task?: Task;
  mode?: "create" | "edit";
  trigger?: React.ReactNode;
}

export function TaskDialog({
  columnId,
  task,
  mode = "create",
  trigger,
}: TaskDialogProps) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");

  // Load task data when editing
  useEffect(() => {
    if (task && mode === "edit") {
      setTitle(task.title);
      setDescription(task.description);
    }
  }, [task, mode]);

  // Reset form when dialog closes
  useEffect(() => {
    if (!open) {
      // Only reset if we're not in edit mode or if we don't have a task
      if (mode === "create" || !task) {
        setTitle("");
        setDescription("");
      }
    }
  }, [open, mode, task]);

  const { mutate: createTask } = useMutation(api.tasks.createTask);
  const { mutate: updateTask } = useMutation(api.tasks.updateTask);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    if (mode === "create") {
      createTask({
        columnId,
        title,
        description,
      });
    } else if (mode === "edit" && task) {
      updateTask({
        id: task._id,
        title,
        description,
      });
    }

    // Close dialog
    setOpen(false);
  };

  const dialogTitle = mode === "create" ? "Add New Task" : "Edit Task";
  const dialogDescription =
    mode === "create"
      ? "Create a new task for this column. Click save when you're done."
      : "Edit the task details. Click save when you're done.";
  const buttonText = mode === "create" ? "Save Task" : "Update Task";

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" className="w-full">
            + Add Task
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>{dialogTitle}</DialogTitle>
            <DialogDescription>{dialogDescription}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="title" className="text-right">
                Title
              </Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="col-span-3"
                placeholder="Task title"
                required
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="description" className="text-right">
                Description
              </Label>
              <Input
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="col-span-3"
                placeholder="Task description"
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="submit">{buttonText}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
