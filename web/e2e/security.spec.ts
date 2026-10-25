import { expect, test } from "@playwright/test";

// Pages with wallet actions must not be frameable (clickjacking); only the widget is made to be embedded.
test("every page sends the security headers and refuses to be framed", async ({ request }) => {
  for (const path of ["/", "/vault", "/developers", "/trove"]) {
    const h = (await request.get(path)).headers();
    expect(h["x-frame-options"], path).toBe("DENY");
    expect(h["content-security-policy"], path).toContain("frame-ancestors 'none'");
    expect(h["content-security-policy"], path).toContain("object-src 'none'");
    expect(h["content-security-policy"], path).toContain("connect-src 'self' https://rpc.test.mezo.org");
    expect(h["x-content-type-options"], path).toBe("nosniff");
    expect(h["referrer-policy"], path).toBe("strict-origin-when-cross-origin");
    expect(h["permissions-policy"], path).toContain("camera=()");
  }
});

test("the widget can be framed by any site, nothing else changes", async ({ request }) => {
  const h = (await request.get("/embed")).headers();
  expect(h["x-frame-options"]).toBeUndefined();
  expect(h["content-security-policy"]).toContain("frame-ancestors *");
  expect(h["x-content-type-options"]).toBe("nosniff");
});

test("API responses are not sniffed and stay readable cross-origin", async ({ request }) => {
  const h = (await request.get("/api/yields?amount=2000")).headers();
  expect(h["x-content-type-options"]).toBe("nosniff");
  expect(h["access-control-allow-origin"]).toBe("*");
});

test("pages still work under the CSP: no CSP violations in the console", async ({ page }) => {
  const violations: string[] = [];
  page.on("console", (m) => m.text().includes("Content Security Policy") && violations.push(m.text()));
  for (const path of ["/", "/vault", "/developers"]) {
    await page.goto(path);
    await page.waitForLoadState("networkidle");
  }
  await page.goto("/vault");
  await page.getByRole("button", { name: "Try a sample" }).click();
  await expect(page.getByText("157.31")).toBeVisible();
  expect(violations).toEqual([]);
});
