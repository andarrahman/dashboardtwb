"use client";

import * as React from "react";
import { RiPieChartLine } from "@remixicon/react";

export default function SegmentsPage() {
  return (
    <main className="px-12 py-10 max-w-[1760px] mx-auto">
      <p className="text-xs font-semibold uppercase tracking-wide text-foreground-muted">
        CRM · Segments
      </p>
      <div className="mt-2">
        <h1 className="text-title-h2 font-bold">Segments</h1>
        <p className="mt-2 text-sm text-foreground-muted">
          Dynamically group contacts by shared attributes and behaviors.
        </p>
      </div>

      <div className="mt-16 flex flex-col items-center justify-center text-center">
        <div className="size-20 rounded-2xl border-2 border-dashed border-border flex items-center justify-center mb-5">
          <RiPieChartLine size={32} className="text-foreground-muted opacity-50" />
        </div>
        <h2 className="text-lg font-semibold text-foreground">Coming soon</h2>
        <p className="mt-2 text-sm text-foreground-muted max-w-sm">
          Segments let you automatically group contacts by tier, country, campaign activity, and more.
          This feature is in development.
        </p>
      </div>
    </main>
  );
}
