"use client";

import React, {useMemo, useState} from "react";
import type { GroupedReports } from "@web-perf-mon/shared";
import { columns, FlatReport } from "./columns";
import { DataTable } from "./data-table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button";

type GroupMode = "project" | "environment" | "none";

interface ReportsTableProps {
  reports: GroupedReports;
}

export default function ReportsTable({ reports }: ReportsTableProps) {

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
          <div className="flex min-w-[180px] flex-1 items-center gap-2 md:flex-none">
            <Select onValueChange={setProjectFilter} defaultValue="all">
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Project" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                {projects.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="flex min-w-[180px] flex-1 items-center gap-2 md:flex-none">
            <Select onValueChange={setEnvFilter} defaultValue="all">
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Environment" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                {environments.map(e => <SelectItem key={e} value={e}>{e}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="flex min-w-[180px] flex-1 items-center gap-2 md:flex-none">
            <Select onValueChange={setVariantFilter} defaultValue="all">
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Variant" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                {variants.map(v => <SelectItem key={v} value={v}>{v}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="flex min-w-[220px] flex-1 items-center gap-2">
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Filter by path…"
              className="block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm outline-none ring-0 focus:border-blue-500"
            />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="inline-flex overflow-hidden rounded-md border border-gray-300 bg-white shadow-sm">
            <Button variant={group === "project" ? "default" : "outline"} onClick={() => setGroup("project")}>Project</Button>
            <Button variant={group === "environment" ? "default" : "outline"} onClick={() => setGroup("environment")}>Environment</Button>
            <Button variant={group === "none" ? "default" : "outline"} onClick={() => setGroup("none")}>None</Button>
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
                <DataTable columns={columns} data={items} />
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