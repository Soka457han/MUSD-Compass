import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { walletConnectEnabled, walletConnectProjectId, walletConnectProvider } from "@/lib/walletconnect";

beforeEach(() => vi.stubGlobal("window", { location: { origin: "https://musd-compass.vercel.app" } })); // the library runs in a browser
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

function loader(opts: { initFails?: boolean; enableFails?: boolean } = {}) {
  const provider = { request: vi.fn(), enable: vi.fn(async () => { if (opts.enableFails) throw new Error("Connection request reset. Please try again."); return ["0xabc"]; }) };
  const init = vi.fn<(o: Record<string, unknown>) => Promise<typeof provider>>(async () => { if (opts.initFails) throw new Error("relay unreachable"); return provider; });
  return { provider, init, load: async () => ({ EthereumProvider: { init } }) as never };
}

describe("walletConnectEnabled", () => {
  it("is off without a Reown project id, so the picker keeps saying it is planned", () => {
    vi.stubEnv("NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID", "");
    expect(walletConnectEnabled()).toBe(false);
  });
  it("is on with one", () => {
    vi.stubEnv("NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID", "abc123");
    expect(walletConnectEnabled()).toBe(true);
    expect(walletConnectProjectId()).toBe("abc123");
  });
});

describe("walletConnectProvider", () => {
  it("starts the QR flow with this project, both Mezo chains optional, and returns the enabled provider", async () => {
    const { provider, init, load } = loader();
    const p = await walletConnectProvider("abc123", load);
    expect(p).toBe(provider);
    expect(init).toHaveBeenCalledOnce();
    expect(init.mock.calls[0][0]).toMatchObject({ projectId: "abc123", showQrModal: true, optionalChains: [31611, 31612], metadata: { url: "https://musd-compass.vercel.app" } });
    expect(provider.enable).toHaveBeenCalledOnce();
  });

  it("says in words that WalletConnect could not start when the library fails to initialise", async () => {
    await expect(walletConnectProvider("abc123", loader({ initFails: true }).load)).rejects.toThrow(/Could not start WalletConnect/);
  });

  it("says the connection was cancelled or timed out when the QR window is closed or expires", async () => {
    await expect(walletConnectProvider("abc123", loader({ enableFails: true }).load)).rejects.toThrow(/cancelled or timed out/);
  });

  it("refuses to start without a project id instead of calling the library", async () => {
    const { init, load } = loader();
    await expect(walletConnectProvider("", load)).rejects.toThrow(/not set up/);
    expect(init).not.toHaveBeenCalled();
  });
});
