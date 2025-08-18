"use client";

import React, { useEffect, useMemo, useState } from "react";
import ReportsTable from "./ReportsTable";
import type { GroupedReports } from "@web-perf-mon/shared";

export default function ReportsBrowser() {
  const [data, setData] = useState<GroupedReports | null>(null);
  const [status, setStatus] = useState<"idle"|"loading"|"error"|"success">("idle");
  const [error, setError] = useState<string>("");

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        setStatus("loading");
        setError("");
        const base = process.env.API_BASE_URL ?? "https://api.perf-mon.examples.oleksiipopov.com";
        const res = await fetch(`${base}/api/browse-reports`, { cache: "no-store" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = (await res.json()) as GroupedReports;
        if (!cancelled) {
          setData(json);
          setStatus("success");
        }
      } catch (e: unknown) {
        if (!cancelled) {
          setError((e as Error)?.message ?? "Unknown error");
          setStatus("error");
        }
      }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  const hasData = useMemo(() => data && Object.keys(data).length > 0, [data]);

  if (status === "loading" || status === "idle") {
    return (
      <div className="flex items-center gap-3 rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
        <span className="h-4 w-4 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
        <span className="text-sm text-gray-700">Loading reports…</span>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
        Failed to load reports: {error}
      </div>
    );
  }

  if (!hasData) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-8 text-center text-gray-600 shadow-sm">
        No reports available yet.
      </div>
    );
  }

  return <ReportsTable reports={data!} />;
}
