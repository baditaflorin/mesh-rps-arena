import { expect, test } from "@playwright/test";
import { openTwoPeers } from "@baditaflorin/mesh-common/testing";
import { readFileSync } from "node:fs";

const pkg = JSON.parse(readFileSync(new URL("../../package.json", import.meta.url), "utf8")) as {
  name: string;
};
const storagePrefix = pkg.name;

test("players-here challenge → both commit → both reveal → winner decided", async ({
  browser,
  baseURL,
}) => {
  const { a, b, cleanup } = await openTwoPeers(browser, baseURL ?? "", { storagePrefix });
  try {
    await a.getByPlaceholder("your name").fill("alice");
    await b.getByPlaceholder("your name").fill("bob");

    // Cross-peer roster: once both have typed a name, each peer sees the OTHER
    // in the shared "players here" list — no QR scan needed for co-located
    // players. alice sees "bob"; bob sees "alice".
    await expect(a.locator(".rps-player")).toContainText("bob");
    await expect(b.locator(".rps-player")).toContainText("alice");

    // One-tap challenge from the roster. The match must appear on BOTH peers'
    // "your matches" list, proving the Y.Map match write synced across the mesh.
    await a.locator(".rps-player", { hasText: "bob" }).getByRole("button").click();
    await expect(a.locator(".rps-list li")).toHaveCount(1);
    await expect(b.locator(".rps-list li")).toHaveCount(1);

    await a.getByRole("button", { name: /rock/ }).click();
    await b.getByRole("button", { name: /scissors/ }).click();

    // Both have committed but neither has revealed yet — both peers see the
    // "ready to reveal" reveal button. Provably-fair invariant: until a peer
    // reveals, only the SHA-256 commit hash crosses the mesh, so the opponent
    // cannot learn the throw. alice threw "rock"; bob threw "scissors".
    await expect(a.getByRole("button", { name: /reveal my throw/ })).toBeVisible();
    await expect(b.getByRole("button", { name: /reveal my throw/ })).toBeVisible();

    // Pre-reveal, alice (peer A) must NOT be able to observe bob's throw
    // "scissors" anywhere in her match list, and bob must not see alice's
    // "rock". (The throw buttons are gone once committed, so these words can
    // only appear if a plaintext throw leaked through the shared doc.)
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

    // Winner earns a leaderboard point that syncs to both peers (XP is awarded
    // once, by the canonical scorer, and the Y.Map XP write reaches both).
    await expect(a.locator(".rps-board")).toContainText("alice");
    await expect(b.locator(".rps-board")).toContainText("alice");
  } finally {
    await cleanup();
  }
});

test("QR-payload paste still works as a cross-device invite path", async ({ browser, baseURL }) => {
  const { a, b, cleanup } = await openTwoPeers(browser, baseURL ?? "", { storagePrefix });
  try {
    await a.getByPlaceholder("your name").fill("carol");
    await b.getByPlaceholder("your name").fill("dave");

    // Paste dave's raw payload into carol's invite form — the cold-start path
    // for someone who scanned a QR from another device.
    await b.locator(".mesh-qrx-payload summary").click();
    const dp = (await b.locator(".mesh-qrx-payload code").textContent()) ?? "";
    await a.getByPlaceholder("or paste a payload (URL or mesh://)").fill(dp);
    await a.getByRole("button", { name: "use", exact: true }).click();

    // The challenge from the pasted payload creates the match on both peers.
    await expect(a.locator(".rps-list li")).toHaveCount(1);
    await expect(b.locator(".rps-list li")).toHaveCount(1);
  } finally {
    await cleanup();
  }
});
