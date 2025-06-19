import React from "react";
import { Link } from "@tanstack/react-router";
import { Route as TableNameRoute } from "../../routes/admin/$tableName";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";

interface AdminLayoutProps {
  children: React.ReactNode;
  tableNames: string[];
}

const AdminLayout: React.FC<AdminLayoutProps> = ({ children, tableNames }) => {
  // Get active table from URL using TanStack Router
  let activeTable: string | undefined;
  try {
    const params = TableNameRoute.useParams();
    activeTable = params.tableName;
  } catch {
    // Not on a tableName route
    activeTable = undefined;
  }

  return (
    <ResizablePanelGroup
      direction="horizontal"
      className="h-[calc(100vh-4rem)] w-full bg-zinc-900 text-zinc-50"
    >
      <ResizablePanel
        defaultSize={20}
        minSize={15}
        maxSize={30}
        className="bg-zinc-800"
      >
        <ScrollArea className="h-full p-4">
          <div className="flex flex-col space-y-1">
            <h2 className="text-lg font-semibold mb-3 px-2 text-zinc-300">
              Tables
            </h2>
            {tableNames.map((tableName) => (
              <Button
                key={tableName}
                variant={activeTable === tableName ? "secondary" : "ghost"}
                className="w-full justify-start"
                asChild
              >
                <Link to="/admin/$tableName" params={{ tableName }}>
                  {tableName}
                </Link>
              </Button>
            ))}
          </div>
        </ScrollArea>
      </ResizablePanel>
      <ResizableHandle withHandle className="bg-zinc-700 hover:bg-zinc-600" />
      <ResizablePanel defaultSize={80} className="bg-zinc-900">
        <ScrollArea className="h-full">{children}</ScrollArea>
      </ResizablePanel>
    </ResizablePanelGroup>
  );
};

export default AdminLayout;
