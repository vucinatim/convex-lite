import { Outlet } from "@tanstack/react-router";
import AdminLayout from "../components/admin/admin-layout";
import { schema } from "../../convex/_schema";

const tableNames = Object.keys(schema);

const AdminPage = () => {
  return (
    <AdminLayout tableNames={tableNames}>
      <div className="p-4">
        <Outlet />
      </div>
    </AdminLayout>
  );
};

export default AdminPage;
