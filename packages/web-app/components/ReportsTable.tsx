"use client";

import React, {useMemo, useState} from "react";
import type { GroupedReports, SingleReport } from "@web-perf-mon/shared";

type FlatReport = SingleReport & { id: string };

type GroupMode = "project" | "environment" | "none";

interface ReportsTableProps {
  reports: GroupedReports;
}

export default function ReportsTable({ reports }: ReportsTableProps) {
  const apiBaseUrl = process.env.API_BASE_URL ?? "https://api.perf-mon.examples.oleksiipopov.com";

  const flat: FlatReport[] = useMemo(() => {
    const rows: FlatReport[] = [];
    Object.entries(reports).forEach(([projectName, byEnv]) => {
      Object.entries(byEnv).forEach(([environment, byVariant]) => {
        Object.entries(byVariant).forEach(([variantName, list]) => {
          list.forEach((r, idx) => {
            rows.push({
              id: `${projectName}:::${environment}:::${variantName}:::${idx}:::${r.path}`,
              projectName,
              environment,
              variantName,
              date: r.date,
              path: r.path,
            });
          });
        });
      });
    });
    // newest first
    rows.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    return rows;
  }, [reports]);

  const projects = useMemo(() => Array.from(new Set(flat.map(r => r.projectName))), [flat]);
  const environments = useMemo(() => Array.from(new Set(flat.map(r => r.environment))), [flat]);
  const variants = useMemo(() => Array.from(new Set(flat.map(r => r.variantName))), [flat]);

  const [projectFilter, setProjectFilter] = useState<string>("all");
  const [envFilter, setEnvFilter] = useState<string>("all");
  const [variantFilter, setVariantFilter] = useState<string>("all");
  const [query, setQuery] = useState("");
  const [group, setGroup] = useState<GroupMode>("project");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return flat.filter(r =>
      (projectFilter === "all" || r.projectName === projectFilter) &&
      (envFilter === "all" || r.environment === envFilter) &&
      (variantFilter === "all" || r.variantName === variantFilter) &&
      (q === "" || r.path.toLowerCase().includes(q))
    );
  }, [flat, projectFilter, envFilter, variantFilter, query]);

  const groupKeys = useMemo(() => {
    if (group === "none") return ["All results"];
    if (group === "project") return Array.from(new Set(filtered.map(r => r.projectName)));
    return Array.from(new Set(filtered.map(r => r.environment)));
  }, [filtered, group]);

  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  const toggle = (key: string) => setCollapsed(prev => ({...prev, [key]: !prev[key]}));

  return (
    <section className="container mx-auto">
      <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div className="flex flex-1 flex-wrap gap-3">
          <Select
            label="Project"
            value={projectFilter}
            onChange={setProjectFilter}
            options={["all", ...projects]}
          />
          <Select
            label="Environment"
            value={envFilter}
            onChange={setEnvFilter}
            options={["all", ...environments]}
          />
          <Select
            label="Variant"
            value={variantFilter}
            onChange={setVariantFilter}
            options={["all", ...variants]}
          />
          <div className="flex min-w-[220px] flex-1 items-center gap-2">
            <label className="text-sm text-gray-600">Search</label>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Filter by path…"
              className="block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm outline-none ring-0 focus:border-blue-500"
            />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-sm text-gray-600">Group by</label>
          <div className="inline-flex overflow-hidden rounded-md border border-gray-300 bg-white shadow-sm">
            <button
              className={btnSeg(group === "project")}
              onClick={() => setGroup("project")}
              type="button"
            >Project</button>
            <button
              className={btnSeg(group === "environment")}
              onClick={() => setGroup("environment")}
              type="button"
            >Environment</button>
            <button
              className={btnSeg(group === "none")}
              onClick={() => setGroup("none")}
              type="button"
            >None</button>
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-gray-200 bg-white shadow-sm">
        {groupKeys.map((key) => {
          const items = filtered.filter(r =>
            group === "none" ? true : group === "project" ? r.projectName === key : r.environment === key
          );
          return (
            <div key={key} className="border-b last:border-b-0">
              {group !== "none" && (
                <button
                  type="button"
                  onClick={() => toggle(key)}
                  className="flex w-full items-center justify-between bg-gray-50 px-4 py-2 text-left hover:bg-gray-100"
                >
                  <div className="flex items-center gap-2">
                    <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-blue-100 text-xs font-medium text-blue-700">{items.length}</span>
                    <span className="font-medium text-gray-900">{key}</span>
                  </div>
                  <svg className={"h-4 w-4 text-gray-500 transition-transform " + (collapsed[key] ? "rotate-180" : "")} viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 10.94l3.71-3.71a.75.75 0 111.06 1.06l-4.24 4.24a.75.75 0 01-1.06 0L5.21 8.29a.75.75 0 01.02-1.08z" clipRule="evenodd"/></svg>
                </button>
              )}

              <div className={(group !== "none" && collapsed[key]) ? "hidden" : "block"}>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <Th>Project</Th>
                        <Th>Environment</Th>
                        <Th>Variant</Th>
                        <Th>Date</Th>
                        <Th>Report</Th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {items.map((r, idx) => (
                        <tr key={r.id} className={idx % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                          <Td><Badge color="indigo">{r.projectName}</Badge></Td>
                          <Td><Badge color="green">{r.environment}</Badge></Td>
                          <Td><Badge color="blue">{r.variantName}</Badge></Td>
                          <Td>
                            <time className="text-sm text-gray-700" dateTime={new Date(r.date).toISOString()}>
                              {new Date(r.date).toLocaleDateString()} {new Date(r.date).toLocaleTimeString()}
                            </time>
                          </Td>
                          <Td>
                            <a
                              className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-700 hover:underline"
                              href={`${apiBaseUrl}/${r.path}`}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path d="M12.293 2.293a1 1 0 011.414 0l4 4A1 1 0 0117 7h-1v6a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h6V3a1 1 0 011-1zM6 6a1 1 0 00-1 1v6a1 1 0 001 1h7a1 1 0 001-1V7a1 1 0 00-1-1H6z"/></svg>
                              Open report
                            </a>
                          </Td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          );
        })}

        {filtered.length === 0 && (
          <div className="p-8 text-center text-gray-600">No results match your filters.</div>
        )}
      </div>
    </section>
  );
}

function Th({children}: {children: React.ReactNode}) {
  return (
    <th scope="col" className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-600">
      {children}
    </th>
  );
}

function Td({children}: {children: React.ReactNode}) {
  return (
    <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-900">
      {children}
    </td>
  );
}

function Badge({children, color = "gray"}: {children: React.ReactNode, color?: "gray"|"indigo"|"green"|"blue"}) {
  const map: Record<string, string> = {
    gray: "bg-gray-100 text-gray-800 ring-gray-200",
    indigo: "bg-indigo-100 text-indigo-800 ring-indigo-200",
    green: "bg-green-100 text-green-800 ring-green-200",
    blue: "bg-blue-100 text-blue-800 ring-blue-200",
  };
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ${map[color]}`}>
      {children}
    </span>
  );
}

function Select({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: string[] }) {
  return (
    <div className="flex min-w-[180px] flex-1 items-center gap-2 md:flex-none">
      <label className="text-sm text-gray-600">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="block w-full rounded-md border border-gray-300 bg-white px-2.5 py-2 text-sm shadow-sm outline-none ring-0 focus:border-blue-500 md:w-[200px]"
      >
        {options.map(opt => (
          <option key={opt} value={opt}>{opt === "all" ? "All" : opt}</option>
        ))}
      </select>
    </div>
  );
}

function btnSeg(active: boolean) {
  return "px-3 py-1.5 text-sm " + (active ? "bg-blue-600 text-white" : "bg-white text-gray-700 hover:bg-gray-50");
}