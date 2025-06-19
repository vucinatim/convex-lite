import { createFileRoute } from "@tanstack/react-router";
import TableDataView from "@/components/admin/table-data-view";

export const Route = createFileRoute("/admin/$tableName")({
  component: AdminTableNamePage,
});

function AdminTableNamePage() {
  return (
    <div>
      <TableDataView />
    </div>
  );
}
