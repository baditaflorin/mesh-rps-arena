import { useEffect, useRef, useState } from "react";
import {
  MeshNameInput,
  QRExchange,
  commit,
  randomSalt,
  verifyReveal,
  makeScanPayload,
  safeJson,
  useStorageNamespace,
  useXP,
  type MeshConfig,
  type YRoom,
} from "@baditaflorin/mesh-common";

type Props = { room: YRoom | null; config: MeshConfig };

type Throw = "rock" | "paper" | "scissors";
type Match = {
  p1: string;
  p2: string;
  p1Commit?: string;
  p2Commit?: string;
  p1Reveal?: { throw: Throw; salt: string };
  p2Reveal?: { throw: Throw; salt: string };
  winner?: string | "draw";
  ts: number;
};

const NAME_KEY = "displayName";
const secretKey = (m: string, peerId: string) => `rps:secret:${peerId}:${m}`;
const matchKey = (a: string, b: string) => (a < b ? `${a}|${b}` : `${b}|${a}`);

function decideWinner(a: Throw, b: Throw, aId: string, bId: string): string | "draw" {
  if (a === b) return "draw";
  if (
    (a === "rock" && b === "scissors") ||
    (a === "paper" && b === "rock") ||
    (a === "scissors" && b === "paper")
  )
    return aId;
  return bId;
}

export function Feature({ room, config }: Props) {
  if (!room) {
    return (
      <div className="viral-screen">
        <h1>rps arena</h1>
        <p className="viral-status">Connecting…</p>
      </div>
    );
  }
  return <Body room={room} config={config} />;
}

function Body({ room, config }: { room: YRoom; config: MeshConfig }) {
  const ns = useStorageNamespace(config.storagePrefix);
  const xp = useXP(room, "rps:xp");
  const [name, setName] = useState(() => ns.get<string>(NAME_KEY) ?? "");
  const [, rerender] = useState(0);

  useEffect(() => {
    if (name) ns.set(NAME_KEY, name);
  }, [name, ns]);

  useEffect(() => {
    const ms = room.doc.getMap<Match>("matches");
    const names = room.doc.getMap<string>("names");
    const cb = () => rerender((n) => n + 1);
    ms.observe(cb);
    names.observe(cb);
    return () => {
      ms.unobserve(cb);
      names.unobserve(cb);
    };
  }, [room]);

  const matches = room.doc.getMap<Match>("matches");
  const names = room.doc.getMap<string>("names");

  useEffect(() => {
    if (name.trim()) names.set(room.peerId, name.trim());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [name, room.peerId]);

  const challenge = (otherId: string, otherName?: string) => {
    if (!name.trim() || otherId === room.peerId) return;
    if (otherName) names.set(otherId, otherName);
    const k = matchKey(room.peerId, otherId);
    if (!matches.has(k)) {
      const m: Match = {
        p1: room.peerId < otherId ? room.peerId : otherId,
        p2: room.peerId < otherId ? otherId : room.peerId,
        ts: Date.now(),
      };
      matches.set(k, m);
    }
  };

  const submitThrow = async (k: string, t: Throw) => {
    const m = matches.get(k);
    if (!m) return;
    const isP1 = m.p1 === room.peerId;
    if (!isP1 && m.p2 !== room.peerId) return;
    const salt = randomSalt();
    const c = await commit(t, salt);
    ns.set(secretKey(k, room.peerId), JSON.stringify({ t, salt }));
    const updated: Match = isP1 ? { ...m, p1Commit: c.hash } : { ...m, p2Commit: c.hash };
    matches.set(k, updated);
  };

  const reveal = async (k: string) => {
    const m = matches.get(k);
    if (!m) return;
    const stored = ns.get<string>(secretKey(k, room.peerId));
    if (!stored) return;
    const parsed = safeJson<{ t: Throw; salt: string }>(stored, { maxBytes: 4096, maxDepth: 4 });
    if (!parsed.ok) return;
    const { t, salt } = parsed.value;
    const isP1 = m.p1 === room.peerId;
    if (!isP1 && m.p2 !== room.peerId) return;
    const expected = isP1 ? m.p1Commit : m.p2Commit;
    if (!expected) return;
    const ok = await verifyReveal(expected, { salt, payload: t });
    if (!ok) return;
    let updated: Match = isP1
      ? { ...m, p1Reveal: { throw: t, salt } }
      : { ...m, p2Reveal: { throw: t, salt } };
    if (updated.p1Reveal && updated.p2Reveal) {
      updated.winner = decideWinner(updated.p1Reveal.throw, updated.p2Reveal.throw, m.p1, m.p2);
    }
    matches.set(k, updated);
  };

  const myPayload = makeScanPayload(room.roomId, room.peerId, name.trim() || "anon");

  // Award XP once per finished match — p1 of the lexically-lower pair is the
  // canonical scorer so two peers can't double-award.
  const awardedRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    const cb = () => {
      matches.forEach((m, k) => {
        if (!m.winner || m.winner === "draw") return;
        if (awardedRef.current.has(k)) return;
        if (m.p1 !== room.peerId) return;
        awardedRef.current.add(k);
        xp.awardTo(m.winner, 1);
      });
    };
    matches.observe(cb);
    cb();
    return () => matches.unobserve(cb);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room.peerId]);

  const board = xp.leaderboard(50);

  const myMatches: Array<Match & { k: string }> = [];
  matches.forEach((m, k) => {
    if (m.p1 === room.peerId || m.p2 === room.peerId) myMatches.push({ ...m, k });
  });
  myMatches.sort((a, b) => b.ts - a.ts);

  return (
    <div className="viral-screen">
      <header>
        <h1>rps arena</h1>
        <p className="viral-status">
          {matches.size} matches · {room.peerCount + 1} present
        </p>
      </header>

      <MeshNameInput
        className="viral-name"
        value={name}
        onChange={setName}
        placeholder="your name"
        maxLength={48}
      />

      <QRExchange
        myPayload={myPayload}
        showLabel="your QR — show to be challenged"
        scanLabel="scan to challenge"
        onScan={(parsed) => challenge(parsed.peerId, parsed.extra ?? undefined)}
      />

      <section>
        <h2 className="viral-section-title">your matches</h2>
        {myMatches.length === 0 ? (
          <p className="viral-empty">no challenges yet</p>
        ) : (
          <ul className="rps-list">
            {myMatches.map((m) => {
              const isP1 = m.p1 === room.peerId;
              const opp = isP1 ? m.p2 : m.p1;
              const myCommit = isP1 ? m.p1Commit : m.p2Commit;
              const oppCommit = isP1 ? m.p2Commit : m.p1Commit;
              const myReveal = isP1 ? m.p1Reveal : m.p2Reveal;
              const oppReveal = isP1 ? m.p2Reveal : m.p1Reveal;
              const phase: string = m.winner
                ? "finished"
                : myReveal || oppReveal
                  ? "revealing"
                  : myCommit && oppCommit
                    ? "ready to reveal"
                    : myCommit || oppCommit
                      ? "waiting on opponent commit"
                      : "pick a throw";
              return (
                <li key={m.k} className="viral-card">
                  <strong>
                    vs {names.get(opp) ?? opp.slice(0, 6)} · {phase}
                  </strong>
                  {!myCommit && !m.winner && (
                    <div className="rps-throws">
                      {(["rock", "paper", "scissors"] as Throw[]).map((t) => (
                        <button
                          key={t}
                          type="button"
                          className="viral-ghost"
                          onClick={() => submitThrow(m.k, t)}
                        >
                          {t === "rock" ? "🪨" : t === "paper" ? "📄" : "✂️"} {t}
                        </button>
                      ))}
                    </div>
                  )}
                  {myCommit && !myReveal && oppCommit && (
                    <button type="button" className="viral-primary" onClick={() => reveal(m.k)}>
                      reveal my throw
                    </button>
                  )}
                  {m.winner && (
                    <p>
                      result: {m.p1Reveal?.throw} vs {m.p2Reveal?.throw} →{" "}
                      <strong>
                        {m.winner === "draw"
                          ? "draw"
                          : m.winner === room.peerId
                            ? "you win 🏆"
                            : "you lose"}
                      </strong>
                    </p>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section>
        <h2 className="viral-section-title">leaderboard</h2>
        {board.length === 0 ? (
          <p className="viral-empty">no wins yet</p>
        ) : (
          <ol className="rps-board">
            {board.map((entry) => (
              <li key={entry.peerId} className={entry.peerId === room.peerId ? "is-me" : ""}>
                <strong>{names.get(entry.peerId) ?? entry.peerId.slice(0, 6)}</strong>{" "}
                <span>+{entry.xp}</span>
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}
