"use client";

import { useState } from "react";
import { useTheme } from "@/shared/lib/use-theme";
import { Icon } from "@/shared/icons";
import {
  ToastProvider,
  useToast,
  Button,
  Field,
  Input,
  Textarea,
  Select,
  SearchInput,
  Badge,
  MutTag,
  ChainBadge,
  Copyable,
  Address,
  Modal,
  Switch,
  Segment,
  type SegmentOption,
  Card,
  CardHead,
  CardTitle,
  CardBody,
  CardFoot,
  Panel,
  SimShell,
  SimStatus,
  SimDetail,
  RevertReason,
  TxGrid,
  TxField,
  Metric,
  Empty,
  Skeleton,
  ErrorBanner,
  Spinner,
} from "@/shared/ui";

/* ---- helpers ---- */
const ADDR = "0x4E6399F5A0d0D13De3De01b7B80d4adEFE2B225c4";
const CHAIN_ETH = { name: "Ethereum", short: "ETH", color: "#627eea" };

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-4">
      <h2 className="border-b border-border pb-2 text-base font-semibold text-fg">
        {title}
      </h2>
      <div className="flex flex-wrap items-start gap-3">{children}</div>
    </section>
  );
}

/* ---- Toast trigger buttons (needs useToast, so lives inside provider) ---- */
function ToastButtons() {
  const push = useToast();
  return (
    <>
      <Button
        variant="success"
        onClick={() =>
          push({ kind: "success", title: "Transaction confirmed" })
        }
      >
        Toast: success
      </Button>
      <Button
        variant="danger"
        onClick={() =>
          push({ kind: "error", title: "Reverted", msg: "Out of gas" })
        }
      >
        Toast: error
      </Button>
      <Button
        variant="write"
        onClick={() =>
          push({ kind: "write", title: "Pending", msg: "Waiting for wallet…" })
        }
      >
        Toast: write
      </Button>
      <Button
        variant="read"
        onClick={() =>
          push({ kind: "info", title: "Info", msg: "Read-only call" })
        }
      >
        Toast: info
      </Button>
    </>
  );
}

/* ---- main gallery (inside provider) ---- */
function Gallery() {
  const [, , toggleTheme] = useTheme();
  const [switchOn, setSwitchOn] = useState(false);
  const [segVal, setSegVal] = useState<"abi" | "storage" | "events">("abi");
  const [modalOpen, setModalOpen] = useState(false);

  const segOptions: SegmentOption<"abi" | "storage" | "events">[] = [
    { value: "abi", label: "ABI" },
    { value: "storage", label: "Storage" },
    { value: "events", label: "Events" },
  ];

  return (
    <div className="relative min-h-screen bg-surface px-6 py-10">
      {/* Theme toggle — fixed top-right */}
      <button
        type="button"
        onClick={toggleTheme}
        className="fixed right-4 top-4 z-50 inline-flex items-center gap-2 rounded-sm border border-border bg-elev-3 px-3 py-1.5 text-[13px] font-medium text-fg shadow transition hover:bg-elev-4"
      >
        <Icon.settings size={14} />
        Toggle theme
      </button>

      <div className="mx-auto flex max-w-4xl flex-col gap-10">
        <div>
          <h1 className="text-2xl font-bold text-fg">
            /ui — Component Gallery
          </h1>
          <p className="mt-1 text-sm text-fg-3">
            Visual verification surface for the EVM Cockpit design system.
          </p>
        </div>

        {/* ---- BUTTONS ---- */}
        <Section title="Buttons">
          {/* All variants at md */}
          {(
            [
              "neutral",
              "ghost",
              "subtle",
              "primary",
              "read",
              "write",
              "success",
              "danger",
            ] as const
          ).map((v) => (
            <Button key={v} variant={v}>
              {v}
            </Button>
          ))}

          {/* read + write fill variants */}
          <Button variant="read" fill="solid">
            read solid
          </Button>
          <Button variant="read" fill="soft">
            read soft
          </Button>
          <Button variant="write" fill="solid">
            write solid
          </Button>
          <Button variant="write" fill="soft">
            write soft
          </Button>

          {/* Sizes */}
          <Button variant="neutral" size="sm">
            sm
          </Button>
          <Button variant="neutral" size="md">
            md
          </Button>
          <Button variant="neutral" size="lg">
            lg
          </Button>

          {/* Icon-only */}
          <Button icon={<Icon.plus />} aria-label="Add" />
          <Button icon={<Icon.search />} variant="ghost" aria-label="Search" />
        </Section>

        {/* ---- INPUTS ---- */}
        <Section title="Inputs">
          <div className="w-full max-w-sm">
            <Field label="Normal input" hint="Enter a value">
              <Input placeholder="0x…" />
            </Field>
          </div>
          <div className="w-full max-w-sm">
            <Field label="Invalid input" error="Invalid address">
              <Input tone="invalid" placeholder="0x…" />
            </Field>
          </div>
          <div className="w-full max-w-sm">
            <Field label="Textarea">
              <Textarea placeholder="Paste ABI here…" />
            </Field>
          </div>
          <div className="w-full max-w-sm">
            <Field label="Select">
              <Select>
                <option>Ethereum</option>
                <option>Arbitrum</option>
                <option>Optimism</option>
              </Select>
            </Field>
          </div>
          <div className="w-full max-w-sm">
            <SearchInput placeholder="Search functions…" />
          </div>
        </Section>

        {/* ---- BADGES ---- */}
        <Section title="Badges">
          <Badge variant="neutral">neutral</Badge>
          <Badge variant="read">read</Badge>
          <Badge variant="write">write</Badge>
          <Badge variant="success" dot>
            success
          </Badge>
          <Badge variant="danger">danger</Badge>

          <MutTag state="view" />
          <MutTag state="pure" />
          <MutTag state="nonpayable" />
          <MutTag state="payable" />

          <ChainBadge chain={CHAIN_ETH} />
          <ChainBadge chain={CHAIN_ETH} sm />
        </Section>

        {/* ---- COPYABLE ---- */}
        <Section title="Copyable">
          <Copyable value="0xdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef" />
          <Address value={ADDR} short link="https://etherscan.io" />
        </Section>

        {/* ---- OVERLAYS ---- */}
        <Section title="Overlays">
          <Button variant="primary" onClick={() => setModalOpen(true)}>
            Open Modal
          </Button>
          {modalOpen && (
            <Modal
              title="Example Modal"
              onClose={() => setModalOpen(false)}
              footer={
                <>
                  <Button variant="ghost" onClick={() => setModalOpen(false)}>
                    Cancel
                  </Button>
                  <Button variant="primary" onClick={() => setModalOpen(false)}>
                    Confirm
                  </Button>
                </>
              }
            >
              <p className="text-[13px] text-fg-2">
                This is modal body content. Pressing Escape or clicking the
                backdrop will close it.
              </p>
            </Modal>
          )}
          <ToastButtons />
        </Section>

        {/* ---- CONTROLS ---- */}
        <Section title="Controls">
          <div className="flex items-center gap-3">
            <Switch checked={switchOn} onChange={setSwitchOn} />
            <span className="text-[13px] text-fg-2">
              {switchOn ? "On" : "Off"}
            </span>
          </div>
          <Segment value={segVal} onChange={setSegVal} options={segOptions} />
        </Section>

        {/* ---- CARDS ---- */}
        <Section title="Cards">
          <Card className="w-72">
            <CardHead>
              <CardTitle>Contract Overview</CardTitle>
            </CardHead>
            <CardBody>
              <p className="text-[13px] text-fg-2">
                Card body content with some information.
              </p>
            </CardBody>
            <CardFoot>
              <span className="text-xs text-fg-3">Last updated 2 min ago</span>
            </CardFoot>
          </Card>

          <Panel className="w-72 p-3.5">
            <p className="text-[13px] text-fg-2">
              Panel — lighter container, no overflow clip.
            </p>
          </Panel>
        </Section>

        {/* ---- SIMULATION PANEL ---- */}
        <Section title="Simulation Panel">
          {/* Success state */}
          <SimShell status="success" className="w-full max-w-xl">
            <SimStatus
              status="success"
              icon={<Icon.checkCircle />}
              headline="Simulation succeeded"
              sub="Gas estimate: 42 000"
              aside={<Badge variant="success">+0.05 ETH</Badge>}
            />
            <SimDetail>
              <TxGrid>
                <TxField label="Gas used" value="42 000" />
                <TxField label="Gas price" value="12 gwei" />
                <TxField label="Block" value="19 450 888" />
              </TxGrid>
              <Metric label="ETH delta" value="+0.05 ETH" />
            </SimDetail>
          </SimShell>

          {/* Revert state */}
          <SimShell status="revert" className="w-full max-w-xl">
            <SimStatus
              status="revert"
              icon={<Icon.xCircle />}
              headline="Transaction reverted"
              sub="Execution failed"
            />
            <SimDetail>
              <RevertReason>
                ERC20: transfer amount exceeds balance
              </RevertReason>
              <TxGrid>
                <TxField label="Gas used" value="21 000" />
                <TxField label="From" value="0xdead…beef" />
              </TxGrid>
            </SimDetail>
          </SimShell>
        </Section>

        {/* ---- STATES ---- */}
        <Section title="States">
          <Empty
            icon={<Icon.layers size={24} />}
            title="No contracts yet"
            actions={<Button variant="read">Import ABI</Button>}
          >
            Paste an ABI or connect a contract address to get started.
          </Empty>

          <div className="flex flex-col gap-2">
            <Skeleton width={240} height={16} />
            <Skeleton width={180} height={16} />
            <Skeleton width={200} height={16} />
          </div>

          <ErrorBanner
            icon={<Icon.xCircle size={18} />}
            title="Failed to fetch ABI"
            hint="Check the contract address and network."
          >
            Network error: 503 Service Unavailable
          </ErrorBanner>

          <div className="flex items-center gap-3">
            <Spinner />
            <Spinner size={24} />
          </div>
        </Section>
      </div>
    </div>
  );
}

/* ---- page export (wraps in ToastProvider) ---- */
export default function UIGalleryPage() {
  return (
    <ToastProvider>
      <Gallery />
    </ToastProvider>
  );
}
