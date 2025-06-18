import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { schema } from "../../../convex/schema"; // Path should be correct
import type { AppSchema, Infer } from "../../../convex/schema"; // Type-only imports

// Placeholder for fetching data - we will replace this with actual data fetching
const fetchTableData = async (
  tableName: keyof AppSchema
): Promise<Infer<AppSchema[typeof tableName]>[]> => {
  console.log(`Fetching data for ${tableName}...`);
  // Simulate API call
  await new Promise((resolve) => setTimeout(resolve, 500));
  // In a real app, this would be an API call to the backend, e.g., /api/tables/:tableName
  // For now, returning empty array or mock data based on schema
  if (tableName === "counters" && schema.counters) {
    // Example: return a mock counter
    return [{ _id: "mock_counter_1", name: "Global", value: 100 }] as Infer<
      typeof schema.counters
    >[];
  }
  return [];
};

const TableDataView: React.FC = () => {
  const { tableName } = useParams<{ tableName: keyof AppSchema }>();
  const [data, setData] = useState<Infer<AppSchema[keyof AppSchema]>[]>([]);
  const [columns, setColumns] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (tableName && schema[tableName]) {
      const tableZodSchema = schema[tableName];
      // Infer columns from Zod schema keys
      if (
        tableZodSchema &&
        "shape" in tableZodSchema &&
        typeof tableZodSchema.shape === "object" &&
        tableZodSchema.shape !== null
      ) {
        setColumns(Object.keys(tableZodSchema.shape));
      } else {
        setColumns([]); // Not an object schema or no shape
      }

      setIsLoading(true);
      setError(null);
      fetchTableData(tableName)
        .then(setData)
        .catch((err) => {
          console.error("Error fetching table data:", err);
          setError(`Failed to load data for table: ${tableName}`);
        })
        .finally(() => setIsLoading(false));
    } else if (tableName) {
      setError(`Unknown table: ${tableName}`);
      setColumns([]);
      setData([]);
    }
  }, [tableName]);

  if (!tableName) {
    return (
      <p className="p-4 text-zinc-400">
        Select a table from the sidebar to view its data.
      </p>
    );
  }

  const currentTableSchema = tableName ? schema[tableName] : null;

  if (isLoading) {
    return <p className="p-4 text-zinc-400">Loading data for {tableName}...</p>;
  }

  if (error) {
    return <p className="p-4 text-red-500">{error}</p>;
  }

  if (!currentTableSchema) {
    return (
      <p className="p-4 text-red-500">
        Schema not found for table: {tableName}.
      </p>
    );
  }

  if (data.length === 0 && columns.length > 0) {
    return (
      <div className="p-4">
        <h2 className="text-xl font-semibold mb-4 text-zinc-100">
          Table: {tableName}
        </h2>
        <p className="text-zinc-400">No data available for this table.</p>
        <div className="mt-4 p-4 border border-zinc-700 rounded-md bg-zinc-800">
          <h3 className="text-lg font-medium text-zinc-200 mb-2">Columns:</h3>
          <ul className="list-disc list-inside text-zinc-300">
            {columns.map((col) => (
              <li key={col}>{col}</li>
            ))}
          </ul>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 text-zinc-50">
      <h2 className="text-2xl font-bold mb-6 text-zinc-100">
        Table: {tableName}
      </h2>
      {columns.length > 0 ? (
        <Table className="border border-zinc-700">
          <TableCaption className="text-zinc-400 py-4">
            A list of records from the "{tableName}" table.
          </TableCaption>
          <TableHeader className="bg-zinc-800">
            <TableRow className="border-b border-zinc-700 hover:bg-zinc-750">
              {columns.map((columnName) => (
                <TableHead
                  key={columnName}
                  className="text-zinc-200 font-semibold p-3"
                >
                  {columnName}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((row, rowIndex) => (
              <TableRow
                key={row._id || rowIndex}
                className="border-b border-zinc-700 hover:bg-zinc-800 transition-colors"
              >
                {columns.map((columnName) => (
                  <TableCell
                    key={`${columnName}-${row._id || rowIndex}`}
                    className="p-3 text-zinc-300"
                  >
                    {typeof row[columnName as keyof typeof row] === "boolean"
                      ? row[columnName as keyof typeof row]
                        ? "true"
                        : "false"
                      : typeof row[columnName as keyof typeof row] === "object"
                      ? JSON.stringify(row[columnName as keyof typeof row])
                      : String(row[columnName as keyof typeof row] ?? "N/A")}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      ) : (
        <p className="text-zinc-400">
          No columns defined for this table or table schema is not an object.
        </p>
      )}
    </div>
  );
};

export default TableDataView;
