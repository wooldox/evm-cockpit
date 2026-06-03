"use client";

import "@rainbow-me/rainbowkit/styles.css";

import { useState, type ReactNode } from "react";
import { WagmiProvider } from "wagmi";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  RainbowKitProvider,
  darkTheme,
  lightTheme,
} from "@rainbow-me/rainbowkit";
import { useTheme } from "@/shared/lib/use-theme";
import { config } from "./config";

function RainbowKitThemed({ children }: { children: ReactNode }) {
  const [theme] = useTheme();
  const rkTheme =
    theme === "dark"
      ? darkTheme({ accentColor: "#3b82f6", accentColorForeground: "white" })
      : lightTheme({ accentColor: "#3b82f6", accentColorForeground: "white" });
  return <RainbowKitProvider theme={rkTheme}>{children}</RainbowKitProvider>;
}

export function Web3Providers({ children }: { children: ReactNode }) {
  // Stable QueryClient — useState ensures it isn't recreated on re-renders.
  const [queryClient] = useState(() => new QueryClient());

  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitThemed>{children}</RainbowKitThemed>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
