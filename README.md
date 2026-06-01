# mesh-rps-arena

[![pages](https://img.shields.io/badge/live-baditaflorin.github.io%2Fmesh-rps-arena-84cc16)](https://baditaflorin.github.io/mesh-rps-arena/)
[![version](https://img.shields.io/badge/version-0.1.1-blue)](https://github.com/baditaflorin/mesh-rps-arena/blob/main/package.json)
[![license](https://img.shields.io/badge/license-MIT-green)](./LICENSE)

> Provably-fair rock-paper-scissors over a P2P mesh — each throw is locked as a hash, then revealed, so no one can peek or change their move

**Live → https://baditaflorin.github.io/mesh-rps-arena/**

**Source → https://github.com/baditaflorin/mesh-rps-arena**

**Tip the dev (buy a coffee) → https://www.paypal.com/paypalme/florinbadita**

**Security audit (programmatic, headless, CPU-only) → [docs/security-audit.md](./docs/security-audit.md)** — re-run with `npm run audit:security`

---

![screenshot](docs/screenshot.png)

## What it is

A **rootless-computing** peer-to-peer browser app. No backend of its own beyond the self-hosted WebRTC stack listed below. State lives in a Yjs mesh shared by everyone in the same room.

Read the principles → **https://baditaflorin.github.io/rootless-computing/principles.html**

## Try it in 30 seconds

1. Open the live URL in **two browser tabs** (both default to the same room).
2. Type a name in each tab.
3. Each tab now lists the other under **players here** — click **challenge**.
4. Both pick a throw (it's locked as a hash, not sent in the clear), then both **reveal** — the winner is decided identically on both screens.

On separate devices, scan the invite QR (or set the same room in ⚙ settings) to join the same room first, then the same flow applies.

## Quickstart

Open the live URL on two devices in the same room (set in ⚙ settings, or scan the room QR). Everything else is in-app.

For local hacking:

```bash
git clone https://github.com/baditaflorin/mesh-common
git clone https://github.com/baditaflorin/mesh-rps-arena
cd mesh-rps-arena
npm install
npm run dev
```

`mesh-common` must sit as a **sibling** directory because `package.json` references it via `file:../mesh-common`.

## Self-hosted infrastructure

| Repo                                              | Endpoint                               | Purpose                     |
| ------------------------------------------------- | -------------------------------------- | --------------------------- |
| https://github.com/baditaflorin/signaling-server  | `wss://turn.0docker.com/ws`            | y-webrtc signaling fan-out  |
| https://github.com/baditaflorin/turn-token-server | `https://turn.0docker.com/credentials` | HMAC TURN creds, 1-hour TTL |
| https://github.com/baditaflorin/coturn-hetzner    | `turn:turn.0docker.com:3479`           | TURN relay                  |

## Settings overrides

The settings drawer lets the user override signaling and TURN endpoints. localStorage keys:

- `mesh-rps-arena:signalingUrl`
- `mesh-rps-arena:turnTokenUrl`
- `mesh-rps-arena:iceServers`
- `mesh-rps-arena:room`

If endpoints are blank or unreachable, the app falls back to STUN-only.

## Version + commit on every screen

The bottom-right footer on every screen of the live app shows:

- `source` → this repo
- `tip ♥` → PayPal
- `vX.Y.Z · <short-sha>` — version from `package.json` plus the build-time git commit

## Build & deploy

GitHub Pages serves the committed `docs/` directory on the `main` branch. There is no GitHub Actions build workflow; local Husky-style hooks gate formatting / typecheck / smoke build before each push.

```bash
npm run smoke                                    # build + sanity-check docs/
bash ../mesh-common/scripts/screenshot-app.sh    # regenerate docs/screenshot.png
```

## Privacy

See `docs/privacy.md` for the threat model — what other peers in the mesh see, what the self-hosted infra sees, what stays local.

## License

MIT — see `LICENSE`.
