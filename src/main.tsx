import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import "./index.css";
import App from "./App.tsx";
import AdminPage from "./pages/admin-page.tsx";
import TableDataView from "./components/admin/table-data-view.tsx";
import { connect as connectWebSocket } from "./lib/websocket";

// Initialize WebSocket connection
connectWebSocket();

// Define routes
const router = createBrowserRouter([
  {
    path: "/",
    element: <App />,
  },
  {
    path: "/admin",
    element: <AdminPage />,
    children: [
      {
        index: true,
        element: (
          <p className="p-4 text-zinc-400">
            Select a table from the sidebar to view its data.
          </p>
        ),
      },
      {
        path: ":tableName",
        element: <TableDataView />,
      },
    ],
  },
]);

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>
);
