"use client";

import { useEffect, useState } from "react";
import {
  attackBoss,
  type CoopBoss as CoopBossData,
  coopBoss,
} from "../../lib/api";
import { haptic } from "../../lib/telegram";
import {
  AppHeader,
  Banner,
  Button,
  Empty,
  Group,
  Row,
  Screen,
  Section,
  SkeletonList,
  type Tone,
  useBackButton,
} from "../ui";

const MEDALS = ["🥇", "🥈", "🥉"];
const MEDAL_TONES: Tone[] = ["brand", "gray", "orange"];

/**
 * Boss cooperativo: the whole group chips a shared boss down with one attack per
 * member per day. Defeating it spawns a tougher one and announces a collective
 * reward. Damage is fixed per hit, so contribution = showing up every day.
 */
export function CoopBoss({ onExit }: { onExit: () => void }) {
  const [data, setData] = useState<CoopBossData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [flash, setFlash] = useState<string | null>(null);

  useBackButton(onExit);

  const load = async () => {
    try {
      setData(await coopBoss());
    } catch (e) {
      setError(e instanceof Error ? e.message : "error");
    }
  };

  // biome-ignore lint/correctness/useExhaustiveDependencies: mount-only load
  useEffect(() => {
    void load();
  }, []);

  const attack = async () => {
    if (busy || !data || data.youAttackedToday) {
      return;
    }
    setBusy(true);
    haptic.impact("medium");
    try {
      const res = await attackBoss();
      if (res.justDefeated) {
        haptic.notify("success");
        setFlash(
          `💥 ¡${res.defeatedName} derrotado! ${res.rewardMessage ?? ""}`,
        );
      } else if (res.alreadyAttacked) {
        setFlash("Ya atacaste hoy. Vuelve mañana. 👋");
      } else {
        haptic.notify("warning");
        setFlash(`¡Golpe! −${res.dealt} de vida al jefe. 💪`);
      }
      setData(res);
    } catch (e) {
      setError(e instanceof Error ? e.message : "error");
    } finally {
      setBusy(false);
    }
  };

  if (error) {
    return (
      <Screen>
        <Banner kind="error">{error}</Banner>
      </Screen>
    );
  }

  if (!data) {
    return (
      <Screen>
        <AppHeader glyph="⚔️" tone="red" title="Boss cooperativo" />
        <SkeletonList rows={4} />
      </Screen>
    );
  }

  return (
    <Screen>
      <AppHeader
        glyph={data.emoji}
        tone="red"
        title={data.name}
        subtitle={`Jefe nivel ${data.level + 1} · ${
          data.scope === "group" ? "todo el grupo pega" : "modo solo"
        }`}
      />
      {flash && <Banner kind="success">{flash}</Banner>}

      <div className="boss">
        <div className="boss-face" aria-hidden="true">
          {data.emoji}
        </div>
        <div
          className="boss-hpbar"
          role="progressbar"
          aria-valuenow={data.percent}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <div className="boss-hp" style={{ width: `${data.percent}%` }} />
        </div>
        <p className="boss-hptext">
          {data.percent}% derrotado · faltan {data.remaining}
        </p>
        <Button
          variant="danger"
          block
          disabled={busy || data.youAttackedToday}
          onClick={() => void attack()}
        >
          {data.youAttackedToday ? "Ya atacaste hoy ✓" : "⚔️ Atacar al jefe"}
        </Button>
        <p className="boss-you">Tu daño a este jefe: {data.yourDamage}</p>
      </div>

      <Section caption="Quién más pega">
        {data.contributors.length === 0 ? (
          <Empty
            icon="🛡️"
            tone="red"
            title="Nadie ha atacado aún"
            hint="¡Sé el primero en golpear!"
          />
        ) : (
          <Group>
            {data.contributors.map((contributor, i) => (
              <Row
                key={contributor.telegramUserId}
                icon={i < 3 ? (MEDALS[i] ?? String(i + 1)) : String(i + 1)}
                tone={i < 3 ? (MEDAL_TONES[i] ?? "gray") : "gray"}
                title={contributor.name ?? contributor.telegramUserId}
                value={
                  <span className="board-points">{contributor.damage}</span>
                }
              />
            ))}
          </Group>
        )}
      </Section>
    </Screen>
  );
}
