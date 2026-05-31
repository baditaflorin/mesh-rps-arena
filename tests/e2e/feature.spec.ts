import { expect, test } from "@playwright/test";
import { openTwoPeers } from "@baditaflorin/mesh-common/testing";
import { readFileSync } from "node:fs";

const pkg = JSON.parse(readFileSync(new URL("../../package.json", import.meta.url), "utf8")) as {
  name: string;
};
const storagePrefix = pkg.name;

test("challenge → both commit → both reveal → winner decided", async ({ browser, baseURL }) => {
  const { a, b, cleanup } = await openTwoPeers(browser, baseURL ?? "", { storagePrefix });
  try {
    await a.getByPlaceholder("your name").fill("alice");
    await b.getByPlaceholder("your name").fill("bob");

    await b.locator(".mesh-qrx-payload summary").click();
    const bp = (await b.locator(".mesh-qrx-payload code").textContent()) ?? "";
    await a.getByPlaceholder("or paste a payload (URL or mesh://)").fill(bp);
    await a.getByRole("button", { name: "use", exact: true }).click();

    await expect(a.locator(".rps-list li")).toHaveCount(1);
    await a.getByRole("button", { name: /rock/ }).click();
    await b.getByRole("button", { name: /scissors/ }).click();

    // Both have committed but neither has revealed yet — both peers see the
    // "ready to reveal" reveal button. Provably-fair invariant: until a peer
    // reveals, only the SHA-256 commit hash crosses the mesh, so the opponent
    // cannot learn the throw. alice threw "rock"; bob threw "scissors".
    await expect(a.getByRole("button", { name: /reveal my throw/ })).toBeVisible();
    await expect(b.getByRole("button", { name: /reveal my throw/ })).toBeVisible();

    // Pre-reveal, alice (peer A) must NOT be able to observe bob's throw
    // "scissors" anywhere on her screen, and bob must not see alice's "rock".
    // (The throw buttons are gone once committed, so these words can only
    // appear if a plaintext throw leaked through the shared doc.)
    await expect(a.locator(".rps-list")).not.toContainText("scissors");
    await expect(b.locator(".rps-list")).not.toContainText("rock");
    // And the match card is in the "ready to reveal" phase, not "finished".
    await expect(a.locator(".rps-list")).toContainText("ready to reveal");
    await expect(a.locator(".rps-list")).not.toContainText("finished");

    await a.getByRole("button", { name: /reveal my throw/ }).click();
    await b.getByRole("button", { name: /reveal my throw/ }).click();

    // After both reveal, BOTH peers compute the same winner from the revealed
    // throws — rock beats scissors, so alice (rock) wins on both screens.
    await expect(a.locator(".rps-list")).toContainText("you win");
    await expect(b.locator(".rps-list")).toContainText("you lose");
    await expect(a.locator(".rps-list")).toContainText("rock");
    await expect(a.locator(".rps-list")).toContainText("scissors");
    await expect(b.locator(".rps-list")).toContainText("you lose");
  } finally {
    await cleanup();
  }
});
