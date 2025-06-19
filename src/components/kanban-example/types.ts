export interface Task {
  _id: string;
  _createdAt: number;
  _updatedAt: number;
  title: string;
  description: string;
  columnId: string;
}

export interface Column {
  _id: string;
  name: string;
  tasks?: Task[];
}

export type DragEndEvent = {
  active: { id: string; data?: { current?: { type?: string; task?: Task } } };
  over: { id: string } | null;
};
