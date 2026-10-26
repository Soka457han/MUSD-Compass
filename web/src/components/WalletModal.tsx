"use client";

import { useEffect, useRef, useState } from "react";
import type { EIP1193Provider } from "viem";
import { discoverWallets, injected, type FoundWallet } from "@/lib/wallet";

// Only wallet-supplied inline images are shown (EIP-6963 icons are data URIs); anything else gets the initial.
const safeIcon = (icon: string) => (/^data:image\/(png|svg\+xml|webp|jpeg|gif);/.test(icon) ? icon : null);

function Badge({ name, icon }: { name: string; icon?: string | null }) {
  // eslint-disable-next-line @next/next/no-img-element
  if (icon) return <img src={icon} alt="" width={36} height={36} className="size-9 shrink-0 rounded-[10px]" />;
  return (
    <span aria-hidden="true" className="flex size-9 shrink-0 items-center justify-center rounded-[10px] bg-surface text-sm font-bold text-ink-muted">
      {name[0]}
    </span>
  );
}

const ROW = "flex min-h-14 w-full items-center gap-3.5 rounded-2xl px-3 text-left";

function Unavailable({ name, note }: { name: string; note: string }) {
  return (
    <li className={`${ROW} text-ink-muted`}>
      <Badge name={name} />
      <span className="min-w-0">
        <span className="block font-bold">{name}</span>
        <span className="block text-xs">{note}</span>
      </span>
    </li>
  );
}

/** "Connect a wallet": every EVM wallet this browser has, plus the ones the vault can't use yet, said plainly. */
export type Picked = { name: string; icon: string | null; provider: EIP1193Provider };

export function WalletModal({
  open,
  onClose,
  onPick,
  picked,
  error,
}: {
  open: boolean;
  onClose: () => void;
  onPick: (w: Picked) => void;
  /** The wallet being connected: the right side then waits on it instead of explaining wallets. */
  picked: Picked | null;
  error: string | null;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [found, setFound] = useState<FoundWallet[]>([]);
  const [legacy, setLegacy] = useState<EIP1193Provider | null>(null);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    setLegacy(injected()); // eslint-disable-line react-hooks/set-state-in-effect
    return discoverWallets((w) => setFound((list) => (list.some((x) => x.uuid === w.uuid) ? list : [...list, w])));
  }, [open]);

  // A browser wallet that does not announce itself (older extensions, in-app wallet browsers) still gets a row.
  const showLegacy = legacy && !found.some((w) => w.provider === legacy);

  return (
    <dialog
      ref={ref}
      aria-labelledby="wallet-modal-h"
      onClose={onClose}
      onClick={(e) => e.target === ref.current && onClose()}
      className="m-auto w-[min(920px,calc(100%-24px))] max-h-[calc(100dvh-24px)] overflow-y-auto rounded-[28px] border border-line bg-card p-0 text-ink backdrop:bg-black/50"
    >
      <div className="grid md:grid-cols-[1fr_1.05fr]">
        <div className="p-5 md:border-r md:border-line md:p-8">
          <div className="flex items-center justify-between gap-3">
            <h2 id="wallet-modal-h" className="text-2xl font-extrabold tracking-tight">
              Connect a wallet
            </h2>
            <button type="button" onClick={onClose} aria-label="Close" className="flex size-11 items-center justify-center rounded-full bg-surface text-xl text-ink-muted hover:text-ink md:hidden">
              ×
            </button>
          </div>

          <h3 className="mt-6 text-[13px] font-semibold text-ink-muted">EVM wallets · work on Mezo testnet</h3>
          <ul className="mt-2 flex flex-col gap-1">
            {found.map((w) => (
              <li key={w.uuid}>
                <button
                  type="button"
                  onClick={() => onPick({ name: w.name, icon: safeIcon(w.icon), provider: w.provider })}
                  aria-pressed={picked?.provider === w.provider}
                  className={`${ROW} hover:bg-surface aria-pressed:bg-accent aria-pressed:text-on-accent`}
                >
                  <Badge name={w.name} icon={safeIcon(w.icon)} />
                  <span className="flex-1 font-bold">{w.name}</span>
                  {picked?.provider !== w.provider && <span className="rounded-full bg-accent-soft px-2.5 py-0.5 text-xs font-semibold text-accent-text">Detected</span>}
                </button>
              </li>
            ))}
            {showLegacy && (
              <li>
                <button
                  type="button"
                  onClick={() => onPick({ name: "Browser wallet", icon: null, provider: legacy })}
                  aria-pressed={picked?.provider === legacy}
                  className={`${ROW} hover:bg-surface aria-pressed:bg-accent aria-pressed:text-on-accent`}
                >
                  <Badge name="Browser wallet" />
                  <span className="flex-1 font-bold">Browser wallet</span>
                  {picked?.provider !== legacy && <span className="rounded-full bg-accent-soft px-2.5 py-0.5 text-xs font-semibold text-accent-text">Detected</span>}
                </button>
              </li>
            )}
            {found.length === 0 && !showLegacy && (
              <li className="rounded-2xl bg-surface px-4 py-3 text-sm">
                No wallet in this browser. Install MetaMask or Rabby on a computer, or on a phone open this page inside your wallet app&apos;s browser.
              </li>
            )}
            <Unavailable name="WalletConnect" note="Phone wallets by QR code, planned for Wave 2" />
          </ul>

          <h3 className="mt-6 text-[13px] font-semibold text-ink-muted">Bitcoin wallets · not supported yet</h3>
          <ul className="mt-2 flex flex-col gap-1">
            {["Unisat", "OKX (Bitcoin)", "Xverse"].map((n) => (
              <Unavailable key={n} name={n} note="The vault needs an EVM wallet for now" />
            ))}
          </ul>
        </div>

        <div className="relative border-t border-line bg-surface p-5 md:border-t-0 md:bg-transparent md:p-8">
          <button type="button" onClick={onClose} aria-label="Close" className="absolute top-6 right-6 hidden size-11 items-center justify-center rounded-full bg-surface text-xl text-ink-muted hover:text-ink md:flex">
            ×
          </button>
          {picked ? (
            <div role="status" aria-live="polite" className="flex min-h-[320px] flex-col items-center justify-center gap-3 text-center">
              <Badge name={picked.name} icon={picked.icon} />
              {error ? (
                <>
                  <p className="text-xl font-extrabold tracking-tight">{picked.name} did not connect</p>
                  <p className="max-w-xs text-sm text-danger-text">{error}</p>
                  <button type="button" onClick={() => onPick(picked)} className="mt-2 inline-flex h-11 items-center rounded-full bg-accent px-5 font-bold text-on-accent">
                    Try again
                  </button>
                </>
              ) : (
                <>
                  <p className="text-xl font-extrabold tracking-tight">Opening {picked.name}…</p>
                  <p className="max-w-xs text-sm text-ink-muted">Confirm the connection in your wallet. It will then ask to switch to Mezo testnet.</p>
                  <span aria-hidden="true" className="mt-2 size-7 animate-spin rounded-full border-[3px] border-line border-t-accent" />
                </>
              )}
            </div>
          ) : (
            <>
            <h3 className="text-xl font-extrabold tracking-tight md:mt-14 md:text-center md:text-2xl">What is a wallet?</h3>
            <dl className="mt-5 flex flex-col gap-5 md:mx-auto md:max-w-sm">
              <div className="grid grid-cols-[44px_1fr] gap-3.5">
                <span aria-hidden="true" className="flex size-11 items-center justify-center rounded-xl bg-tile-lilac text-tile-ink">
                  <svg viewBox="0 0 24 24" className="size-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 7h15a3 3 0 0 1 3 3v8H3zM3 7l12-3v3M16 13h2" /></svg>
                </span>
                <div>
                  <dt className="font-bold">A home for your digital assets</dt>
                  <dd className="text-sm text-ink-muted">Wallets send, receive and hold tokens like MUSD and BTC.</dd>
                </div>
              </div>
              <div className="grid grid-cols-[44px_1fr] gap-3.5">
                <span aria-hidden="true" className="flex size-11 items-center justify-center rounded-xl bg-tile-pink text-tile-ink">
                  <svg viewBox="0 0 24 24" className="size-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="5" y="11" width="14" height="9" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></svg>
                </span>
                <div>
                  <dt className="font-bold">A new way to log in</dt>
                  <dd className="text-sm text-ink-muted">Connect your wallet instead of making an account and password.</dd>
                </div>
              </div>
            </dl>
            <p className="mt-6 text-sm text-ink-muted md:mx-auto md:max-w-sm md:text-center">
              Compass asks your wallet to switch to Mezo testnet (chain 31611). It never asks for your seed phrase and never holds your funds.
            </p>
            <p className="mt-5 flex flex-col items-start gap-2 md:items-center">
              <a href="https://ethereum.org/en/wallets/find-wallet/" target="_blank" rel="noreferrer" className="inline-flex h-11 items-center rounded-full bg-accent px-5 font-bold text-on-accent no-underline">
                Get a wallet
              </a>
              <a href="https://ethereum.org/en/wallets/" target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center font-semibold text-accent-text underline">
                Learn more
              </a>
            </p>
            </>
          )}
        </div>
      </div>
    </dialog>
  );
}
