"use client";

// Casino hub — the page orchestrates the shell (kit Screen + AppHeader with the
// live ChipBadge), holds the shared balance + result state, and swaps between
// the game grid and a single selected game. Each game reports its settled round
// through onResult, which surfaces the animated ResultCard at the top level.

import { type JSX, useEffect, useState } from "react";
import { Baccarat } from "../../components/casino/Baccarat";
import { Blackjack } from "../../components/casino/Blackjack";
import { Crash } from "../../components/casino/Crash";
import { Dice } from "../../components/casino/Dice";
import { HiLo } from "../../components/casino/HiLo";
import { Keno } from "../../components/casino/Keno";
import { Leaderboard } from "../../components/casino/Leaderboard";
import { Mines } from "../../components/casino/Mines";
import { Plinko } from "../../components/casino/Plinko";
import { Roulette } from "../../components/casino/Roulette";
import { SicBo } from "../../components/casino/SicBo";
import {
  type CasinoGameProps,
  ChipBadge,
  type GameResult,
  JackpotBanner,
  ResultCard,
} from "../../components/casino/shared";
import { Tournament } from "../../components/casino/Tournament";
import {
  AppHeader,
  Group,
  GroupNote,
  Row,
  Screen,
  type Tone,
  useBackButton,
} from "../../components/ui";
import { casinoBalance, getJackpot } from "../../lib/api";
import { getStartParam, ready } from "../../lib/telegram";

// Playable games (each backed by a bet API) versus the social views
// (leaderboard, tournament) that are plain read-only panels.
type PlayableGame =
  | "crash"
  | "mines"
  | "plinko"
  | "roulette"
  | "dice"
  | "blackjack"
  | "sicbo"
  | "baccarat"
  | "keno"
  | "hilo";
type SocialView = "leaderboard" | "tournament";
type Game = "hub" | PlayableGame | SocialView;

interface GameMeta {
  id: PlayableGame;
  title: string;
  desc: string;
  icon: string;
  tone: Tone;
  Component: (props: CasinoGameProps) => JSX.Element;
}

const GAMES: GameMeta[] = [
  {
    id: "crash",
    title: "Crash",
    desc: "Retira antes de que explote.",
    icon: "🚀",
    tone: "red",
    Component: Crash,
  },
  {
    id: "mines",
    title: "Minas",
    desc: "Destapa sin tocar minas.",
    icon: "💣",
    tone: "orange",
    Component: Mines,
  },
  {
    id: "plinko",
    title: "Plinko",
    desc: "Suelta la ficha y mira dónde cae.",
    icon: "🔵",
    tone: "blue",
    Component: Plinko,
  },
  {
    id: "roulette",
    title: "Ruleta",
    desc: "Rojo/negro, docenas…",
    icon: "🎡",
    tone: "purple",
    Component: Roulette,
  },
  {
    id: "dice",
    title: "Dado",
    desc: "Bajo/alto provably-fair.",
    icon: "🎲",
    tone: "teal",
    Component: Dice,
  },
  {
    id: "blackjack",
    title: "Blackjack",
    desc: "Planta o pide contra el crupier.",
    icon: "🃏",
    tone: "green",
    Component: Blackjack,
  },
  {
    id: "sicbo",
    title: "Sic Bo",
    desc: "Apuesta a la suma de 3 dados.",
    icon: "🎲",
    tone: "red",
    Component: SicBo,
  },
  {
    id: "baccarat",
    title: "Baccarat",
    desc: "Jugador, banca o empate.",
    icon: "🂡",
    tone: "gray",
    Component: Baccarat,
  },
  {
    id: "keno",
    title: "Keno",
    desc: "Elige 3 números del 1 al 20.",
    icon: "🔢",
    tone: "green",
    Component: Keno,
  },
  {
    id: "hilo",
    title: "Hi-Lo",
    desc: "¿La siguiente carta sube o baja?",
    icon: "🔺",
    tone: "orange",
    Component: HiLo,
  },
];

export default function CasinoPage(): JSX.Element {
  const [game, setGame] = useState<Game>("hub");
  const [balance, setBalance] = useState<number | null>(null);
  const [result, setResult] = useState<GameResult | null>(null);
  const [jackpot, setJackpot] = useState<number | null>(null);

  const refresh = async () => {
    try {
      setBalance((await casinoBalance()).balance);
    } catch {
      // best-effort
    }
    try {
      setJackpot((await getJackpot()).amount);
    } catch {
      // best-effort — the banner just keeps showing its last known pot / "…".
    }
  };

  // biome-ignore lint/correctness/useExhaustiveDependencies: mount-only
  useEffect(() => {
    ready();
    void refresh();
    const sp = getStartParam();
    if (sp?.startsWith("casino_")) {
      const g = sp.slice("casino_".length).split("_")[0] as PlayableGame;
      if (GAMES.some((x) => x.id === g)) {
        setGame(g);
      }
    }
  }, []);

  const back = () => {
    setGame("hub");
    void refresh();
  };

  const active = GAMES.find((g) => g.id === game);

  return (
    <Screen className="casino-screen">
      <AppHeader
        title="Casino"
        tone="brand"
        glyph="🎰"
        subtitle={<ChipBadge balance={balance} />}
      />

      {active ? (
        <ActiveGame
          meta={active}
          balance={balance}
          onBalance={setBalance}
          onResult={setResult}
          onBack={back}
        />
      ) : game === "leaderboard" ? (
        <SocialPanel title="Clasificación" icon="🏆" tone="brand" onBack={back}>
          <Leaderboard />
        </SocialPanel>
      ) : game === "tournament" ? (
        <SocialPanel
          title="Torneo semanal"
          icon="🥇"
          tone="orange"
          onBack={back}
        >
          <Tournament />
        </SocialPanel>
      ) : (
        <>
          <JackpotBanner amount={jackpot} />
          <Group className="casino-hub">
            {GAMES.map((g) => (
              <Row
                key={g.id}
                icon={g.icon}
                tone={g.tone}
                title={g.title}
                subtitle={g.desc}
                chevron
                onClick={() => setGame(g.id)}
              />
            ))}
          </Group>
          <Group className="casino-social-hub">
            <Row
              icon="🏆"
              tone="brand"
              title="Clasificación"
              subtitle="Los mejores por fichas netas."
              chevron
              onClick={() => setGame("leaderboard")}
            />
            <Row
              icon="🥇"
              tone="orange"
              title="Torneo semanal"
              subtitle="Compite por el bote de cada semana."
              chevron
              onClick={() => setGame("tournament")}
            />
          </Group>
          <GroupNote>
            Fichas virtuales, solo diversión. Provably-fair: cada resultado se
            puede verificar con la semilla revelada.
          </GroupNote>
        </>
      )}

      <ResultCard result={result} onDismiss={() => setResult(null)} />
    </Screen>
  );
}

/** A read-only social view (leaderboard / tournament) with a titled head and
 *  Telegram's back arrow bound for its lifetime. */
function SocialPanel({
  title,
  icon,
  tone,
  onBack,
  children,
}: {
  title: string;
  icon: string;
  tone: Tone;
  onBack: () => void;
  children: JSX.Element;
}): JSX.Element {
  useBackButton(onBack);
  return (
    <div className="casino-game-wrap">
      <div className="casino-game-head">
        <span className={`tile tone-${tone}`} aria-hidden="true">
          {icon}
        </span>
        <h2 className="casino-game-title">{title}</h2>
      </div>
      {children}
    </div>
  );
}

/** A single selected game: binds Telegram's back arrow, then renders it. */
function ActiveGame({
  meta,
  balance,
  onBalance,
  onResult,
  onBack,
}: {
  meta: GameMeta;
  balance: number | null;
  onBalance: (n: number) => void;
  onResult: (r: GameResult) => void;
  onBack: () => void;
}): JSX.Element {
  useBackButton(onBack);
  const { Component } = meta;
  return (
    <div className="casino-game-wrap">
      <div className="casino-game-head">
        <span className={`tile tone-${meta.tone}`} aria-hidden="true">
          {meta.icon}
        </span>
        <h2 className="casino-game-title">{meta.title}</h2>
      </div>
      <Component balance={balance} onBalance={onBalance} onResult={onResult} />
    </div>
  );
}
