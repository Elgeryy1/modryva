"use client";

import type { DashboardData } from "@superbot/shared";
import { useCallback, useEffect, useState } from "react";
import { ApiError, getDashboard } from "../lib/api";
import { ready } from "../lib/telegram";
import { Banner, Empty, SkeletonStats } from "./ui";

type LoadState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ready"; data: DashboardData }
  | { status: "empty" }
  | { status: "error"; message: string };

export function DashboardPanel() {
  const [state, setState] = useState<LoadState>({ status: "idle" });

  const load = useCallback(async () => {
    ready();
    setState({ status: "loading" });
    try {
      // getDashboard() goes through apiFetch, which attaches the auth header +
      // X-Bot-Username so a managed child bot's panel resolves against its own
      // bot/tenant instead of the parent.
      const data = await getDashboard();
      setState(
        data.cards.length > 0 ? { status: "ready", data } : { status: "empty" },
      );
    } catch (error) {
      const message =
        error instanceof ApiError
          ? error.status === 0
            ? "Abre el panel desde la Mini App de Telegram."
            : error.message
          : "No se pudo contactar con la API.";
      setState({ status: "error", message });
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const busy = state.status === "loading" || state.status === "idle";

  return (
    <section className="sec">
      <div className="dash-head">
        <span className="cap">Actividad</span>
        <button
          type="button"
          className="dash-refresh"
          onClick={() => void load()}
          disabled={busy}
        >
          {busy ? "…" : "↻ Actualizar"}
        </button>
      </div>

      {busy && <SkeletonStats count={4} />}

      {state.status === "empty" && (
        <Empty
          icon="📊"
          tone="blue"
          title="Sin actividad todavía"
          hint="Cuando tu grupo se mueva, verás aquí miembros, mensajes y moderación."
        />
      )}

      {state.status === "error" && (
        <Banner kind="error">{state.message}</Banner>
      )}

      {state.status === "ready" && (
        <>
          <div className="stat-grid">
            {state.data.cards.map((card) => (
              <article key={card.key} className="stat">
                <span className="stat-value">{card.value}</span>
                <span className="stat-label">{card.label}</span>
              </article>
            ))}
          </div>
          <p className="dash-foot">
            Actualizado {new Date(state.data.generatedAt).toLocaleString()}
          </p>
        </>
      )}
    </section>
  );
}
