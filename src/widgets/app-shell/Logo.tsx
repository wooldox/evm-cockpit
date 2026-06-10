import { Icon } from '@/shared/icons';

export function Logo() {
  return (
    <div className="flex items-center gap-[9px]">
      <div className="grid size-7 place-items-center rounded-[7px] bg-[linear-gradient(140deg,var(--read),var(--write))] text-white shadow-[var(--shadow-sm)]">
        <Icon.bolt size={15} />
      </div>
      <div className="text-[15px] font-semibold tracking-[-0.01em]">
        EVM <span className="font-medium text-fg-3">Cockpit</span>
      </div>
    </div>
  );
}
