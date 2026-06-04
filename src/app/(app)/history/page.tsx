"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { HistoryView } from "@/features/history/ui/HistoryView";

function HistoryRoute() {
  const c = useSearchParams().get("c");
  return <HistoryView initialContractId={c ?? undefined} />;
}

export default function HistoryPage() {
  return (
    <Suspense fallback={null}>
      <HistoryRoute />
    </Suspense>
  );
}
