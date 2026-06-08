"use client";

import { useSettingsStore } from "@/entities/settings/model/store";
import { useTheme } from "@/shared/lib/use-theme";
import { Icon } from "@/shared/icons";
import { Modal, Field, Input, Segment, Button } from "@/shared/ui";
import { useAppShell } from "@/widgets/app-shell/AppShellProvider";
import { CustomRpcManager } from "./CustomRpcManager";

export function SettingsModal({ onClose }: { onClose: () => void }) {
  const [theme, setTheme] = useTheme();
  const density = useSettingsStore((s) => s.density);
  const setDensity = useSettingsStore((s) => s.setDensity);
  const etherscanApiKey = useSettingsStore((s) => s.etherscanApiKey);
  const setEtherscanApiKey = useSettingsStore((s) => s.setEtherscanApiKey);

  const { currentChainId } = useAppShell();

  return (
    <Modal
      title="Settings"
      onClose={onClose}
      footer={
        <Button variant="primary" onClick={onClose}>
          Done
        </Button>
      }
    >
      <div className="flex flex-col gap-[18px]">
        <Field label="Theme">
          <Segment
            value={theme}
            onChange={setTheme}
            options={[
              { value: "dark", label: "Dark", icon: <Icon.moon size={14} /> },
              { value: "light", label: "Light", icon: <Icon.sun size={14} /> },
            ]}
          />
        </Field>

        <Field label="Density">
          <Segment
            value={density}
            onChange={setDensity}
            options={[
              { value: "comfortable", label: "Comfortable" },
              { value: "compact", label: "Compact" },
            ]}
          />
        </Field>

        {/* TODO(backlog): corners + write-accent tweaks */}

        <Field
          label="Etherscan V2 API key"
          hint="Stored locally — raises auto-fetch rate limits."
        >
          <Input
            mono
            value={etherscanApiKey}
            onChange={(e) => setEtherscanApiKey(e.target.value)}
            placeholder="Optional · stored in your browser only"
          />
        </Field>

        <CustomRpcManager currentChainId={currentChainId} />
      </div>
    </Modal>
  );
}
