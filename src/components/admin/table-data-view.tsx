import React, { useEffect, useState, useMemo } from "react";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useQuery } from "../../hooks/use-convex-lite"; // Import useQuery
import { api } from "convex/_generated/api";
import { useParams } from "@tanstack/react-router";

const TableDataView: React.FC = () => {
  const tableName = useParams({
    from: "/admin/$tableName",
    select: (params) => params.tableName,
  });
  // tableName is string from route param, or undefined if not present

  const [columns, setColumns] = useState<string[]>([]);

  // Memoize the queryParams object to stabilize its reference
  const queryParams = useMemo(() => {
    return tableName ? { tableNameString: tableName } : undefined;
  }, [tableName]);

  // Query for the table data using the new API endpoint
  // tableName is asserted as string here because the component returns early if it's not.
  const {
    data: rawData, // Expected to be Record<string, unknown>[] | null
    isLoading,
    error,
  } = useQuery(
    api.tables.getAdminTableData,
    queryParams as { tableNameString: string }
  );

  useEffect(() => {
    if (
      rawData &&
      rawData.length > 0 &&
      typeof rawData[0] === "object" &&
      rawData[0] !== null
    ) {
      setColumns(Object.keys(rawData[0]));
    } else {
      // If no data or data is not in expected format, or table is empty
      setColumns([]);
    }
  }, [rawData]);

  if (!tableName) {
    return <p className="p-4 text-zinc-400">No table specified.</p>;
  }

  // isLoading is true only if tableName is present and query is active
  // if (isLoading && tableName) {
  //   return <p className="p-4 text-zinc-400">Loading data for {tableName}...</p>;
  // }

  if (error) {
    return (
      <p className="p-4 text-red-500">
        Error loading data for {tableName}:{" "}
        {error.message || "Failed to load data"}
      </p>
    );
  }

  // If there's a tableName, but no data, no columns derived, and not loading, and no error yet,
  // it could be an empty table or data is genuinely null.
  // The new 'get_admin_table_data' API will throw an error for non-existent tables,
  // which should be caught by the 'error' state above.
  if (tableName && !rawData && !isLoading && !error) {
    return (
      <p className="p-4 text-zinc-400">
        No data available for table: {tableName}, or table is empty.
      </p>
    );
  }

  // If rawData is an empty array and columns were not derived (or derived as empty)
  if (rawData && rawData.length === 0) {
    return (
      <div className="p-4">
        <h2 className="text-xl font-semibold mb-4 text-zinc-100">
          Table: {tableName}
        </h2>
        <p className="text-zinc-400">
          No data available for this table (table is empty).
        </p>
      </div>
    );
  }

  // If we have columns and data, render the table.
  // This also implies rawData is not null and not empty.
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
            {rawData.map((row: Record<string, unknown>, rowIndex: number) => {
              // row is already Record<string, unknown> due to useQuery typing
              return (
                <TableRow
                  key={(row._id as string) || rowIndex} // Assuming _id is primary key
                  className="border-b border-zinc-700 hover:bg-zinc-800 transition-colors"
                >
                  {columns.map((columnName) => {
                    const cellValue = row[columnName];
                    return (
                      <TableCell
                        key={`${columnName}-${(row._id as string) || rowIndex}`}
                        className="p-3 text-zinc-300"
                      >
                        {typeof cellValue === "boolean"
                          ? cellValue
                            ? "True"
                            : "False"
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
      ) : (
        // This case should ideally be covered by earlier checks (isLoading, error, no data, empty table)
        // If tableName is present, but we reach here, it implies an unexpected state.
        <p className="text-zinc-400 p-4">
          Table data for "{tableName}" could not be displayed. There might be no
          data or columns.
        </p>
      )}
    </div>
  );
};

export default TableDataView;
