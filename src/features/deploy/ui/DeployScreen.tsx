"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useAccount, useChainId } from "wagmi";
import type { RpcProvider } from "@/shared/ports/rpc";
import { useDeploy } from "@/features/deploy/model/useDeploy";
import { useContractsStore } from "@/entities/contract/model/store";
import type { TContract } from "@/entities/contract/model/types";
import { getChainDisplay } from "@/entities/chain/model/chains";
import { addressUrl, txUrl } from "@/entities/chain/model/explorer";
import { trunc } from "@/shared/lib/format";
import { type EthUnit } from "@/shared/lib/units/units";
import { Icon } from "@/shared/icons";
import {
  Badge,
  Button,
  Card,
  CardBody,
  CardHead,
  CardTitle,
  ChainBadge,
  Eyebrow,
  Mono,
  Muted,
  MutTag,
  Spinner,
  Textarea,
  useToast,
} from "@/shared/ui";
import { Copyable, ExtLink } from "@/shared/ui/copyable";
import { Field } from "@/shared/ui/field";
import { ParamInput } from "@/features/contract-browser/ui/values";
import { EthValueInput } from "@/features/contract-browser/ui/EthValueInput";

type Deps = { rpc: RpcProvider };

const ABI_PLACEHOLDER = '[ { "type": "constructor", "inputs": [...] } ]';

export function DeployScreen({ deps }: { deps?: Deps }) {
  const {
    artifact,
    parseArtifact,
    deployState,
    argErrors,
    valueError,
    deploy,
  } = useDeploy(deps);

  const toast = useToast();
  const router = useRouter();
  const { isConnected } = useAccount();
  const walletChainId = useChainId();
  const chain = getChainDisplay(walletChainId);

  // Raw textarea contents (the model parses them on every change).
  const [abiRaw, setAbiRaw] = useState("");
  const [bytecodeRaw, setBytecodeRaw] = useState("");

  // Constructor arg + ETH value state, mirroring OperationCard.
  const [args, setArgs] = useState<Record<string, string>>({});
  const [ethAmount, setEthAmount] = useState("");
  const [ethUnit, setEthUnit] = useState<EthUnit>("ether");

  const fileInputRef = useRef<HTMLInputElement>(null);
  // Synchronous guard: blocks a second click before the disabled state commits.
  const deployBusyRef = useRef(false);
  // Once saved, always saved — a double-click must not add the contract twice.
  const savedRef = useRef(false);
  const [saved, setSaved] = useState(false);

  function onAbiChange(next: string): void {
    setAbiRaw(next);
    parseArtifact(next, bytecodeRaw);
  }

  function onBytecodeChange(next: string): void {
    setBytecodeRaw(next);
    parseArtifact(abiRaw, next);
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>): Promise<void> {
    const file = e.target.files?.[0];
    // Reset the input so picking the same file twice re-fires onChange.
    e.target.value = "";
    if (!file) return;
    const text = await file.text();
    // Drop the bytecode textarea so any bytecode embedded in the artifact
    // object is used — unless the user later pastes an explicit one.
    setAbiRaw(text);
    setBytecodeRaw("");
    parseArtifact(text, "");
  }

  const ready = artifact.status === "ready" ? artifact.artifact : null;
  const payable = ready?.payable ?? false;

  const invalid = artifact.status === "invalid" ? artifact : null;

  const confirmed = deployState.status === "confirmed" ? deployState : null;
  const failed = deployState.status === "failed" ? deployState : null;

  const busy =
    deployState.status === "wallet" || deployState.status === "pending";

  let deployLabel = "Deploy";
  if (deployState.status === "wallet") deployLabel = "Confirm in wallet…";
  else if (deployState.status === "pending") deployLabel = "Deploying…";

  const deployDisabled = !ready || !isConnected || busy;
  const deployTitle = !isConnected ? "Connect a wallet to deploy" : undefined;

  async function handleDeploy(): Promise<void> {
    if (!ready) return;
    if (deployBusyRef.current) return;
    deployBusyRef.current = true;
    try {
      const final = await deploy(
        args,
        payable ? { amount: ethAmount, unit: ethUnit } : undefined,
      );
      if (final.status === "confirmed") {
        toast({
          kind: "success",
          title: "Contract deployed",
          msg: (
            <>
              Deployed at <Mono>{trunc(final.contractAddress, 6)}</Mono>
            </>
          ),
        });
      } else if (final.status === "failed") {
        toast({ kind: "error", title: "Deployment failed", msg: final.error });
      }
    } finally {
      deployBusyRef.current = false;
    }
  }

  function handleSave(): void {
    if (!confirmed || !ready) return;
    if (savedRef.current) return;
    savedRef.current = true;
    setSaved(true);
    const id = crypto.randomUUID();
    const contract: TContract = {
      id,
      name: `Deployed ${trunc(confirmed.contractAddress, 6)}`,
      chainId: walletChainId,
      address: confirmed.contractAddress,
      abi: ready.abi,
      source: "manual",
      addedAt: Date.now(),
    };
    useContractsStore.getState().add(contract);
    toast({
      kind: "success",
      title: "Saved to contracts",
      msg: (
        <>
          <Mono>{contract.name}</Mono> added to your contracts.
        </>
      ),
    });
    router.push(`/?c=${id}`);
  }

  const addrLink = confirmed
    ? addressUrl(walletChainId, confirmed.contractAddress)
    : undefined;
  const hashLink = confirmed ? txUrl(walletChainId, confirmed.hash) : undefined;

  return (
    <div className="mx-auto w-full max-w-[1080px] px-7 pb-16 pt-6">
      {/* page head */}
      <div className="mb-[22px] flex items-start justify-between gap-4">
        <div>
          <h1 className="text-[22px] font-semibold tracking-[-0.02em]">
            Deploy contract
          </h1>
          <p className="mt-1 max-w-[560px] text-[13px] leading-normal text-fg-3">
            Provide constructor arguments + bytecode, then broadcast the
            deployment transaction.
          </p>
        </div>
        <div className="flex flex-col items-end gap-1.5">
          <ChainBadge chain={chain} />
          <Muted className="text-[11px]">
            deploys to your wallet&apos;s current network
          </Muted>
        </div>
      </div>

      <div className="grid grid-cols-2 items-start gap-[18px] max-[860px]:grid-cols-1">
        {/* ── Artifact card ── */}
        <Card>
          <CardHead>
            <Icon.code size={15} className="text-fg-3" />
            <CardTitle>Artifact</CardTitle>
            <Muted className="ml-auto text-xs">ABI + bytecode</Muted>
          </CardHead>
          <CardBody className="flex flex-col gap-3.5">
            <Field label="ABI" type="json[]" error={invalid?.abiError}>
              <Textarea
                mono
                rows={6}
                tone={invalid?.abiError ? "invalid" : "default"}
                placeholder={ABI_PLACEHOLDER}
                value={abiRaw}
                onChange={(e) => onAbiChange(e.target.value)}
              />
            </Field>
            <Field label="Bytecode" type="bytes" error={invalid?.bytecodeError}>
              <Textarea
                mono
                rows={4}
                tone={invalid?.bytecodeError ? "invalid" : "default"}
                placeholder="0x60806040…"
                value={bytecodeRaw}
                onChange={(e) => onBytecodeChange(e.target.value)}
              />
            </Field>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex cursor-pointer items-center justify-center gap-[9px] rounded-sm border border-dashed border-border-strong bg-transparent p-4 text-[13px] text-fg-3 transition-colors hover:border-read-border hover:bg-read-bg hover:text-fg-2"
            >
              <Icon.file size={18} />
              <span>
                or browse for a <Mono>.json</Mono> artifact (Hardhat / Foundry)
              </span>
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".json"
              className="hidden"
              aria-label="Browse for a .json artifact"
              onChange={(e) => void onFile(e)}
            />
          </CardBody>
        </Card>

        {/* ── Constructor card ── */}
        <Card>
          <CardHead>
            <span className="h-[15px] w-[3px] rounded-[2px] bg-write" />
            <CardTitle>Constructor</CardTitle>
            {ready && <MutTag state={payable ? "payable" : "nonpayable"} />}
          </CardHead>
          <CardBody>
            <div className="mb-3.5 inline-flex items-center gap-[7px] rounded-sm border border-write-border bg-write-bg px-2.5 py-1.5 text-xs font-medium text-write-fg">
              <Icon.bolt size={13} /> Deployment is a write — costs gas, creates
              a new contract
            </div>

            {ready ? (
              <>
                <div className="flex flex-col gap-3">
                  {ready.constructorInputs.map((p, i) => {
                    const key = p.name ?? String(i);
                    return (
                      <ParamInput
                        key={key}
                        param={p}
                        value={args[key]}
                        error={argErrors[key]}
                        autoFocus={i === 0}
                        onChange={(v) => setArgs((s) => ({ ...s, [key]: v }))}
                      />
                    );
                  })}
                  {payable && (
                    <EthValueInput
                      amount={ethAmount}
                      unit={ethUnit}
                      error={valueError}
                      onChange={(amount, unit) => {
                        setEthAmount(amount);
                        setEthUnit(unit);
                      }}
                    />
                  )}
                </div>

                <div className="mt-4 flex items-center gap-2">
                  <Button
                    variant="write"
                    icon={busy ? <Spinner /> : <Icon.rocket size={15} />}
                    onClick={() => void handleDeploy()}
                    disabled={deployDisabled}
                    title={deployTitle}
                  >
                    {deployLabel}
                  </Button>
                </div>
              </>
            ) : (
              <Muted className="text-[13px]">
                Paste an ABI and bytecode to configure the deployment.
              </Muted>
            )}

            {/* failed → inline danger above the result/buttons */}
            {failed && (
              <p className="mt-3 font-mono text-[12px] text-danger-fg">
                {failed.error}
              </p>
            )}

            {/* result block */}
            {confirmed && (
              <div className="mt-3.5 rounded-sm border border-border bg-inset">
                <div className="flex items-center justify-between gap-2 border-b border-border py-1.5 pl-3 pr-2">
                  <Eyebrow>Deployment</Eyebrow>
                  <Badge size="sm" variant="success">
                    confirmed
                  </Badge>
                </div>
                <div className="flex flex-col gap-2 px-3.5 py-[11px]">
                  <div className="flex items-center gap-2.5">
                    <Muted className="min-w-20 text-xs">Address</Muted>
                    <Copyable
                      value={confirmed.contractAddress}
                      display={trunc(confirmed.contractAddress, 6)}
                      link={addrLink}
                    />
                  </div>
                  <div className="flex items-center gap-2.5">
                    <Muted className="min-w-20 text-xs">Tx hash</Muted>
                    <span className="inline-flex items-center gap-[7px]">
                      <span className="font-mono text-[13px] text-fg-2">
                        {trunc(confirmed.hash, 6)}
                      </span>
                      {hashLink && <ExtLink href={hashLink} />}
                    </span>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <Muted className="min-w-20 text-xs">Gas used</Muted>
                    <span className="font-mono text-[13px]">
                      {confirmed.gasUsed.toLocaleString()}
                    </span>
                  </div>
                </div>
                <div className="border-t border-border px-3.5 py-[11px]">
                  <Button
                    variant="primary"
                    icon={<Icon.plus size={15} />}
                    onClick={handleSave}
                    disabled={saved}
                    title={saved ? "saved" : undefined}
                  >
                    Save to contracts
                  </Button>
                </div>
              </div>
            )}
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
