"use client";
import { useCallback, useEffect, useState } from "react";
import type { Address } from "viem";
import { humanError, injected, remember, restoreWallet } from "@/lib/wallet";

/** The browser wallet's account for the read-only pages. It comes back after a refresh without a popup; connect() asks the wallet once. It never switches networks or sends anything. */
export function useOwnWallet() {
  const [account, setAccount] = useState<Address | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => restoreWallet((_, a) => setAccount(a)), []);

  const connect = useCallback(async () => {
    setError(null);
    const p = injected();
    if (!p) return setError("No browser wallet found. Paste an address or press Try a sample.");
    try {
      const [a] = (await p.request({ method: "eth_requestAccounts" })) as Address[];
      if (!a) return setError("The wallet gave no account.");
      remember("injected");
      setAccount(a);
    } catch (e) {
      setError(humanError(e));
    }
  }, []);

  return { account, error, connect };
}
