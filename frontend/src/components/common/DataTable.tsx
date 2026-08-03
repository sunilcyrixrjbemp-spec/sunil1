import React, { useState, useMemo } from "react";
import { Search, ChevronDown, ChevronUp, ChevronLeft, ChevronRight, Inbox } from "lucide-react";
import Button from "./Button";

export interface Column<T> {
  key: string;
  header: string;
  accessor?: (row: T) => React.ReactNode;
  sortable?: boolean;
  align?: "left" | "center" | "right";
  width?: string;
}

export interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  keyExtractor: (row: T) => string | number;
  pageSize?: number;
  searchable?: boolean;
  searchPlaceholder?: string;
  emptyMessage?: string;
  emptyTitle?: string;
  onRowClick?: (row: T) => void;
  actionHeader?: React.ReactNode;
  isLoading?: boolean;
  selectable?: boolean;
  selectedKeys?: Set<string | number>;
  onSelectionChange?: (selectedKeys: Set<string | number>) => void;
}

export function DataTable<T extends Record<string, any>>({
  columns,
  data,
  keyExtractor,
  pageSize = 10,
  searchable = true,
  searchPlaceholder = "Search records...",
  emptyMessage = "No matching records found.",
  emptyTitle = "No Data Available",
  onRowClick,
  actionHeader,
  isLoading = false,
  selectable = false,
  selectedKeys = new Set(),
  onSelectionChange,
}: DataTableProps<T>) {
  const [searchTerm, setSearchTerm] = useState("");
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const [currentPage, setCurrentPage] = useState(1);

  // Filter data based on search
  const filteredData = useMemo(() => {
    if (!searchTerm.trim()) return data;
    const lowerSearch = searchTerm.toLowerCase();
    return data.filter((row) =>
      Object.values(row).some((val) =>
        val !== null && val !== undefined && String(val).toLowerCase().includes(lowerSearch)
      )
    );
  }, [data, searchTerm]);

  // Sort data
  const sortedData = useMemo(() => {
    if (!sortKey) return filteredData;
    return [...filteredData].sort((a, b) => {
      const valA = a[sortKey];
      const valB = b[sortKey];
      if (valA === valB) return 0;
      if (valA === null || valA === undefined) return 1;
      if (valB === null || valB === undefined) return -1;
      
      const comp = valA < valB ? -1 : 1;
      return sortDirection === "asc" ? comp : -comp;
    });
  }, [filteredData, sortKey, sortDirection]);

  // Pagination
  const totalPages = Math.ceil(sortedData.length / pageSize) || 1;
  const paginatedData = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return sortedData.slice(start, start + pageSize);
  }, [sortedData, currentPage, pageSize]);

  const handleSort = (key: string) => {
    if (sortKey === key) {
      if (sortDirection === "asc") setSortDirection("desc");
      else setSortKey(null);
    } else {
      setSortKey(key);
      setSortDirection("asc");
    }
  };

  const toggleSelectAll = () => {
    if (!onSelectionChange) return;
    const pageKeys = paginatedData.map(keyExtractor);
    const allSelected = pageKeys.every((k) => selectedKeys.has(k));
    const next = new Set(selectedKeys);
    if (allSelected) {
      pageKeys.forEach((k) => next.delete(k));
    } else {
      pageKeys.forEach((k) => next.add(k));
    }
    onSelectionChange(next);
  };

  const toggleSelectRow = (key: string | number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!onSelectionChange) return;
    const next = new Set(selectedKeys);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    onSelectionChange(next);
  };

  return (
    <div className="bg-surface-0 border border-border rounded-lg shadow-xs overflow-hidden flex flex-col w-full">
      {/* Table Controls Header */}
      {(searchable || actionHeader) && (
        <div className="p-4 border-b border-border bg-slate-50/50 flex flex-col sm:flex-row items-center justify-between gap-3">
          {searchable ? (
            <div className="relative w-full sm:w-72">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-ink-500" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setCurrentPage(1);
                }}
                placeholder={searchPlaceholder}
                className="w-full h-9 pl-9 pr-3 text-xs md:text-sm bg-white border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-accent-600/30 focus:border-accent-600 text-ink-900 transition-all placeholder:text-ink-500"
              />
            </div>
          ) : <div />}

          {actionHeader && <div className="flex items-center gap-2 w-full sm:w-auto">{actionHeader}</div>}
        </div>
      )}

      {/* Main Table View */}
      <div className="overflow-x-auto w-full min-h-[220px] relative">
        {isLoading && (
          <div className="absolute inset-0 bg-white/70 backdrop-blur-xs z-10 flex items-center justify-center">
            <div className="flex items-center gap-2 text-sm text-accent-600 font-medium bg-white px-4 py-2 rounded-lg shadow-sm border border-border">
              <div className="w-4 h-4 border-2 border-accent-600 border-t-transparent rounded-full animate-spin" />
              Loading records...
            </div>
          </div>
        )}

        <table className="w-full text-left text-xs md:text-sm border-collapse">
          <thead>
            <tr className="bg-slate-100/70 border-b border-border text-ink-700 text-xs uppercase tracking-wider font-semibold">
              {selectable && (
                <th className="w-10 px-4 py-3 text-center">
                  <input
                    type="checkbox"
                    checked={
                      paginatedData.length > 0 &&
                      paginatedData.every((r) => selectedKeys.has(keyExtractor(r)))
                    }
                    onChange={toggleSelectAll}
                    className="w-4 h-4 rounded text-accent-600 focus:ring-accent-600 cursor-pointer"
                  />
                </th>
              )}
              {columns.map((col) => (
                <th
                  key={col.key}
                  style={{ width: col.width }}
                  onClick={() => col.sortable && handleSort(col.key)}
                  className={`px-4 py-3 font-semibold select-none ${
                    col.sortable ? "cursor-pointer hover:bg-slate-200/60 transition-colors" : ""
                  } ${col.align === "right" ? "text-right" : col.align === "center" ? "text-center" : "text-left"}`}
                >
                  <div className={`inline-flex items-center gap-1.5 ${col.align === "right" ? "flex-row-reverse" : ""}`}>
                    <span>{col.header}</span>
                    {col.sortable && (
                      <span className="text-ink-500">
                        {sortKey === col.key ? (
                          sortDirection === "asc" ? (
                            <ChevronUp className="w-3.5 h-3.5 text-accent-600" />
                          ) : (
                            <ChevronDown className="w-3.5 h-3.5 text-accent-600" />
                          )
                        ) : (
                          <ChevronDown className="w-3.5 h-3.5 opacity-30 group-hover:opacity-100" />
                        )}
                      </span>
                    )}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {paginatedData.length > 0 ? (
              paginatedData.map((row) => {
                const key = keyExtractor(row);
                const isSelected = selectedKeys.has(key);
                return (
                  <tr
                    key={key}
                    onClick={() => onRowClick && onRowClick(row)}
                    className={`transition-colors hover:bg-slate-50/80 ${
                      isSelected ? "bg-accent-50/40" : ""
                    } ${onRowClick ? "cursor-pointer" : ""}`}
                  >
                    {selectable && (
                      <td className="px-4 py-3 text-center" onClick={(e) => toggleSelectRow(key, e)}>
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => {}}
                          className="w-4 h-4 rounded text-accent-600 focus:ring-accent-600 cursor-pointer"
                        />
                      </td>
                    )}
                    {columns.map((col) => (
                      <td
                        key={col.key}
                        className={`px-4 py-3 text-ink-900 font-normal ${
                          col.align === "right"
                            ? "text-right"
                            : col.align === "center"
                            ? "text-center"
                            : "text-left"
                        }`}
                      >
                        {col.accessor ? col.accessor(row) : row[col.key] ?? "-"}
                      </td>
                    ))}
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan={columns.length + (selectable ? 1 : 0)} className="py-12 text-center text-ink-500">
                  <div className="flex flex-col items-center justify-center gap-2">
                    <div className="p-3 bg-slate-100 rounded-full text-ink-500">
                      <Inbox className="w-6 h-6" />
                    </div>
                    <p className="font-semibold text-ink-900 text-sm">{emptyTitle}</p>
                    <p className="text-xs text-ink-500 max-w-sm">{emptyMessage}</p>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Footer */}
      {totalPages > 1 && (
        <div className="px-4 py-3 border-t border-border bg-slate-50/50 flex items-center justify-between gap-2 text-xs md:text-sm text-ink-700">
          <div>
            Showing{" "}
            <span className="font-semibold text-ink-900">
              {Math.min((currentPage - 1) * pageSize + 1, sortedData.length)}
            </span>{" "}
            to{" "}
            <span className="font-semibold text-ink-900">
              {Math.min(currentPage * pageSize, sortedData.length)}
            </span>{" "}
            of <span className="font-semibold text-ink-900">{sortedData.length}</span> entries
          </div>

          <div className="flex items-center gap-1.5">
            <Button
              variant="outline"
              size="sm"
              disabled={currentPage === 1}
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>

            <span className="px-3 py-1 font-medium text-ink-900">
              Page {currentPage} of {totalPages}
            </span>

            <Button
              variant="outline"
              size="sm"
              disabled={currentPage === totalPages}
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

export default DataTable;
