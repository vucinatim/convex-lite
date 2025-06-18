import React from "react";
import { Link, useParams } from "react-router-dom";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable"; // Assuming default ShadCN import path
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";

interface AdminLayoutProps {
  children: React.ReactNode;
  tableNames: string[]; // Add tableNames prop
}

const AdminLayout: React.FC<AdminLayoutProps> = ({ children, tableNames }) => {
  const { tableName: activeTable } = useParams(); // Get active table from URL

  return (
    <ResizablePanelGroup
      direction="horizontal"
      className="h-screen w-screen bg-zinc-900 text-zinc-50"
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
                variant={activeTable === tableName ? "secondary" : "ghost"} // Highlight active table
                className="w-full justify-start"
                asChild // Important: Allows Button to wrap Link
              >
                <Link to={`/admin/${tableName}`}>{tableName}</Link>
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
