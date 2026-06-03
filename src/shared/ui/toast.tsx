"use client";

import {
  createContext,
  startTransition,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { Icon } from "@/shared/icons";
import { XBtn } from "./modal";
import { cx } from "@/shared/lib/cx";

export type ToastKind = "success" | "error" | "write" | "info";

export interface ToastInput {
  kind?: ToastKind;
  title: ReactNode;
  /** Rich message — pass JSX (use <Mono> for inline code). No HTML strings. */
  msg?: ReactNode;
  duration?: number;
}

interface ToastItem extends ToastInput {
  id: string;
}

const ToastCtx = createContext<((t: ToastInput) => void) | null>(null);

const kindStyles: Record<
  ToastKind,
  { bar: string; icon: string; node: ReactNode }
> = {
  success: {
    bar: "border-l-success",
    icon: "text-success-fg",
    node: <Icon.checkCircle size={18} />,
  },
  error: {
    bar: "border-l-danger",
    icon: "text-danger-fg",
    node: <Icon.xCircle size={18} />,
  },
  write: {
    bar: "border-l-write",
    icon: "text-write-fg",
    node: <Icon.bolt size={18} />,
  },
  info: {
    bar: "border-l-read",
    icon: "text-read-fg",
    node: <Icon.info size={18} />,
  },
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [mounted, setMounted] = useState(false);
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  useEffect(() => {
    startTransition(() => setMounted(true));
  }, []);
  useEffect(() => {
    const t = timers.current;
    return () => {
      Object.values(t).forEach(clearTimeout);
    };
  }, []);

  const remove = useCallback((id: string) => {
    setToasts((s) => s.filter((x) => x.id !== id));
  }, []);

  const push = useCallback(
    (t: ToastInput) => {
      const id = Math.random().toString(36).slice(2);
      setToasts((s) => [...s, { id, ...t }]);
      timers.current[id] = setTimeout(() => remove(id), t.duration ?? 5200);
    },
    [remove],
  );

  return (
    <ToastCtx.Provider value={push}>
      {children}
      {mounted &&
        createPortal(
          <div className="fixed bottom-[18px] right-[18px] z-[200] flex w-[360px] max-w-[calc(100vw-36px)] flex-col gap-2.5">
            {toasts.map((t) => {
              const s = kindStyles[t.kind ?? "info"];
              return (
                <div
                  key={t.id}
                  className={cx(
                    "flex gap-[11px] rounded-md border border-l-[3px] border-border-strong bg-elev-2 p-3",
                    "shadow-[var(--shadow-pop)] animate-toast-in",
                    s.bar,
                  )}
                >
                  <span className={cx("mt-px size-[18px] flex-none", s.icon)}>
                    {s.node}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="text-[13px] font-semibold text-fg">
                      {t.title}
                    </div>
                    {t.msg != null && (
                      <div className="mt-0.5 text-xs leading-[1.45] text-fg-3 [&_.font-mono]:text-fg-2">
                        {t.msg}
                      </div>
                    )}
                  </div>
                  <XBtn
                    onClick={() => remove(t.id)}
                    size={14}
                    className="size-[22px]"
                  />
                </div>
              );
            })}
          </div>,
          document.body,
        )}
    </ToastCtx.Provider>
  );
}

export function useToast(): (t: ToastInput) => void {
  const ctx = useContext(ToastCtx);
  if (!ctx) throw new Error("useToast must be used within <ToastProvider>");
  return ctx;
}
