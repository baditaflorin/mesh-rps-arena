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
    await a.getByPlaceholder("or paste a mesh:// payload").fill(bp);
    await a.getByRole("button", { name: "use", exact: true }).click();

    await expect(a.locator(".rps-list li")).toHaveCount(1);
    await a.getByRole("button", { name: /rock/ }).click();
    await b.getByRole("button", { name: /scissors/ }).click();

    await expect(a.getByRole("button", { name: /reveal my throw/ })).toBeVisible();
    await a.getByRole("button", { name: /reveal my throw/ }).click();
    await b.getByRole("button", { name: /reveal my throw/ }).click();

    await expect(a.locator(".rps-list")).toContainText("you win");
    await expect(b.locator(".rps-list")).toContainText("you lose");
  } finally {
    await cleanup();
  }
});
