"use client"

import { ColumnDef } from "@tanstack/react-table"
import { SingleReport } from "@web-perf-mon/shared";

export type FlatReport = SingleReport & { id: string };

export const columns: ColumnDef<FlatReport>[] = [
  {
    accessorKey: "projectName",
    header: "Project",
  },
  {
    accessorKey: "environment",
    header: "Environment",
  },
  {
    accessorKey: "variantName",
    header: "Variant",
  },
  {
    accessorKey: "date",
    header: "Date",
  },
  {
    id: "actions",
    cell: ({ row }) => {
      const report = row.original
      const apiBaseUrl = process.env.API_BASE_URL ?? "https://api.perf-mon.examples.oleksiipopov.com";
 
      return (
        <a
          className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-700 hover:underline"
          href={`${apiBaseUrl}/${report.path}`}
          target="_blank"
          rel="noopener noreferrer"
        >
          <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path d="M12.293 2.293a1 1 0 011.414 0l4 4A1 1 0 0117 7h-1v6a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h6V3a1 1 0 011-1zM6 6a1 1 0 00-1 1v6a1 1 0 001 1h7a1 1 0 001-1V7a1 1 0 00-1-1H6z"/></svg>
          Open report
        </a>
      )
    },
  },
]