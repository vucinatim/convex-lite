import { Outlet } from "react-router-dom";
import AdminLayout from "../components/admin/admin-layout";
import { schema } from "../../convex/schema";

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
