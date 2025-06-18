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
import type { AppSchema } from "../../../convex/schema"; // Type-only imports
import { useQuery } from "../../hooks/use-convex-lite"; // Import useQuery

const TableDataView: React.FC = () => {
  const { tableName } = useParams<{ tableName: string }>();
  // tableName is string from route param

  const [columns, setColumns] = useState<string[]>([]);

  useEffect(() => {
    if (tableName && Object.prototype.hasOwnProperty.call(schema, tableName)) {
      const tableZodSchema = schema[tableName as keyof AppSchema]; // Safe cast after check
      if (
        tableZodSchema &&
        "shape" in tableZodSchema &&
        typeof tableZodSchema.shape === "object" &&
        tableZodSchema.shape !== null
      ) {
        setColumns(Object.keys(tableZodSchema.shape));
      } else {
        setColumns([]);
      }
    } else {
      setColumns([]);
    }
  }, [tableName]);

  const queryKeyForTableData = tableName ? `table_${tableName}` : undefined;

  // Expect raw data as unknown[] from the server for generic table queries
  const {
    data: rawData, // Type will be unknown[] | null
    isLoading,
    error,
  } = useQuery<unknown[]>(queryKeyForTableData);

  if (!tableName) {
    return <p className="p-4 text-zinc-400">No table specified.</p>;
  }

  const currentTableSchemaExists = Object.prototype.hasOwnProperty.call(
    schema,
    tableName
  );

  if (isLoading) {
    return <p className="p-4 text-zinc-400">Loading data for {tableName}...</p>;
  }

  if (error) {
    return (
      <p className="p-4 text-red-500">
        Error: {error.message || "Failed to load data"}
      </p>
    );
  }

  if (!currentTableSchemaExists && !isLoading) {
    return (
      <p className="p-4 text-red-500">
        Schema not found for table: {tableName}. Or table does not exist.
      </p>
    );
  }

  // rawData is unknown[] | null. We use optional chaining for length and map.
  if ((!rawData || rawData.length === 0) && columns.length > 0) {
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
      {columns.length > 0 && rawData && rawData.length > 0 ? (
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
            {rawData.map((row: unknown, rowIndex: number) => {
              const recordRow = row as Record<string, unknown>; // Cast unknown row to Record for property access
              return (
                <TableRow
                  key={(recordRow._id as string) || rowIndex}
                  className="border-b border-zinc-700 hover:bg-zinc-800 transition-colors"
                >
                  {columns.map((columnName) => {
                    const cellValue = recordRow[columnName];
                    return (
                      <TableCell
                        key={`${columnName}-${
                          (recordRow._id as string) || rowIndex
                        }`}
                        className="p-3 text-zinc-300"
                      >
                        {typeof cellValue === "boolean"
                          ? cellValue
                            ? "true"
                            : "false"
                          : typeof cellValue === "object" && cellValue !== null
                          ? JSON.stringify(cellValue)
                          : String(cellValue ?? "N/A")}
                      </TableCell>
                    );
                  })}
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      ) : isLoading || (!rawData && !error) ? null : (
        <p className="text-zinc-400 p-4">
          No columns defined for this table, or table data could not be loaded.
        </p>
      )}
    </div>
  );
};

export default TableDataView;
