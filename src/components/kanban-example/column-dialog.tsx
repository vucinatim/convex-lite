import { useState } from "react";
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

interface ColumnDialogProps {
  trigger?: React.ReactNode;
}

export function ColumnDialog({ trigger }: ColumnDialogProps) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");

  const { mutate: createColumn } = useMutation(api.columns.createColumn);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    createColumn({
      name,
    });

    // Reset form and close dialog
    setName("");
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || <Button>Add Column</Button>}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Add New Column</DialogTitle>
            <DialogDescription>
              Create a new column for your Kanban board. Click save when you're
              done.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="name" className="text-right">
                Name
              </Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="col-span-3"
                placeholder="Column name"
                required
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="submit">Save Column</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
