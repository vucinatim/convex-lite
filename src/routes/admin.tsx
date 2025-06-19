import { createFileRoute } from "@tanstack/react-router";
import AdminPage from "../pages/admin-page";

export const Route = createFileRoute("/admin")({
  component: AdminPage,
});
