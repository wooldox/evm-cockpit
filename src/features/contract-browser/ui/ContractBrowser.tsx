"use client";

import { useState } from "react";
import type { TContract } from "@/entities/contract/model/types";
import { getBrowserSections } from "@/features/contract-browser/model/effectiveAbi";
import { Icon } from "@/shared/icons";
import { Badge, Empty, Input, Muted, Panel } from "@/shared/ui";
import { ContractHeader } from "./ContractHeader";
import { PropertiesSection, SectionHead } from "./PropertiesSection";
import { GettersSection } from "./GettersSection";

/* ── NoFunctionMatch ─────────────────────────────────────── */
function NoFunctionMatch({ q }: { q: string }) {
  return (
    <Empty
      icon={<Icon.search size={24} />}
      title={`No functions match "${q}"`}
    />
  );
}

/* ── ContractBrowser ─────────────────────────────────────── */
export function ContractBrowser({
  contract,
  onRemoved,
}: {
  contract: TContract;
  onRemoved: () => void;
}) {
  const [q, setQ] = useState("");
  const ql = q.toLowerCase();

  const sections = getBrowserSections(contract);

  const noMatch =
    q &&
    ![
      ...sections.properties,
      ...sections.getters,
      ...sections.operations,
      ...sections.events,
    ].some((x) => x.name.toLowerCase().includes(ql));

  return (
    <div className="flex min-h-0 flex-col">
      <ContractHeader contract={contract} onRemoved={onRemoved} />

      {/* Sticky toolbar */}
      <div className="sticky top-0 z-10 flex items-center gap-3 border-b border-border bg-[color-mix(in_oklab,var(--bg)_88%,transparent)] px-7 py-3.5 backdrop-blur-[8px]">
        <div className="relative flex max-w-[420px] flex-1 items-center">
          <Icon.search
            size={14}
            className="pointer-events-none absolute left-2.5 text-fg-3"
          />
          <Input
            className="pl-[30px]"
            placeholder="Filter functions across all sections…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <Badge variant="read" size="sm" dot>
          read = free
        </Badge>
        <Badge variant="write" size="sm" dot>
          write = sends tx
        </Badge>
      </div>

      {/* Body */}
      <div
        data-cc="cb-body"
        className="mx-auto flex w-full max-w-[1080px] flex-col gap-7 px-7 pb-16 pt-5"
      >
        <PropertiesSection contract={contract} q={ql} />
        <GettersSection contract={contract} q={ql} />

        {/* Operations placeholder */}
        {sections.operations.length > 0 && (
          <section>
            <SectionHead
              tone="write"
              title="Operations"
              count={sections.operations.length}
            />
            <Panel className="p-3.5">
              <Muted className="text-sm">
                Write operations — simulate &amp; send — arrive in the next
                milestone (M3).
              </Muted>
            </Panel>
          </section>
        )}

        {/* Events placeholder */}
        {sections.events.length > 0 && (
          <section>
            <SectionHead
              tone="read"
              title="Events"
              count={sections.events.length}
            />
            <Panel className="p-3.5">
              <Muted className="text-sm">
                Event log fetching arrives in M4.
              </Muted>
            </Panel>
          </section>
        )}

        {noMatch && <NoFunctionMatch q={q} />}
      </div>
    </div>
  );
}
