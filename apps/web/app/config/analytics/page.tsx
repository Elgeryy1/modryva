"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useState } from "react";
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
  useBackButton,
} from "../../../components/ui";
import {
  applyDoctorFix,
  getNetworkAnalytics,
  type NetworkAnalytics,
} from "../../../lib/api-analytics";
import { haptic, ready } from "../../../lib/telegram";

const ERROR_LABELS: Record<string, string> = {
  "not-admin":
    "Solo los administradores del grupo pueden ver este panel. Si te acaban de dar admin, espera unos segundos y vuelve a abrirlo.",
  "not-network-admin":
    "Solo el propietario o un admin de la red puede ver las analiticas de red.",
  "chat-not-found": "No encuentro este grupo.",
  "invalid-body": "Falta indicar que recomendacion aplicar.",
  "no-auto-fix": "Esta recomendacion no tiene un arreglo automatico todavia.",
};

const humanError = (message: string): string =>
  ERROR_LABELS[message] ?? message;

const HOUR_LABELS = Array.from({ length: 24 }, (_, hour) =>
  hour.toString().padStart(2, "0"),
);

function AnalyticsInner() {
  const router = useRouter();
  const search = useSearchParams();
  const gid = search.get("gid") ?? "";

  const [data, setData] = useState<NetworkAnalytics | null>(null);
  const [busyFix, setBusyFix] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useBackButton(() => router.back());

  const load = useCallback(() => {
    if (!gid) {
      setError("Abre esta pantalla desde tu grupo.");
      return;
    }
    getNetworkAnalytics(gid)
      .then(setData)
      .catch((e: Error) => setError(humanError(e.message)));
  }, [gid]);

  useEffect(() => {
    ready();
    load();
  }, [load]);

  const onFix = useCallback(
    async (recommendationId: string) => {
      if (busyFix) {
        return;
      }
      setBusyFix(recommendationId);
      setError(null);
      try {
        setData(await applyDoctorFix(gid, recommendationId));
        haptic.notify("success");
      } catch (e) {
        setError(humanError(e instanceof Error ? e.message : "error"));
        haptic.notify("error");
      } finally {
        setBusyFix(null);
      }
    },
    [gid, busyFix],
  );

  const autoFixableIds = new Set(["enable-captcha", "enable-antiflood"]);
  const peakHour = data
    ? data.hourlyRaidSpamEvents.reduce(
        (best, count, hour) => (count > best.count ? { hour, count } : best),
        { hour: 0, count: 0 },
      )
    : null;

  return (
    <Screen>
      <AppHeader
        glyph="A"
        tone="teal"
        title="Analiticas de red"
        subtitle="Actividad, salud y recomendaciones de todos tus grupos"
      />

      {error && <Banner kind="error">{error}</Banner>}

      {data === null ? (
        <SkeletonList rows={4} />
      ) : (
        <>
          <Group>
            <Row
              icon="G"
              tone="blue"
              title="Grupos en la red"
              value={String(data.chatCount)}
            />
            <Row
              icon="M"
              tone="teal"
              title="Mensajes totales"
              value={String(data.totalMessages)}
            />
            <Row
              icon="U"
              tone="purple"
              title="Usuarios activos"
              value={String(data.activeUsers)}
            />
            <Row
              icon="S"
              tone={data.healthScore >= 70 ? "teal" : "orange"}
              title="Salud de la red"
              value={`${data.healthScore}/100`}
            />
          </Group>

          <Section caption="Top posters (red completa)">
            {data.topPosters.length === 0 ? (
              <Empty
                icon="U"
                tone="gray"
                title="Todavia no hay actividad"
                hint="Cuando la gente escriba en los grupos veras el ranking aqui."
              />
            ) : (
              <Group>
                {data.topPosters.map((poster) => (
                  <Row
                    key={poster.telegramUserId}
                    icon="U"
                    tone="blue"
                    title={poster.username ?? poster.telegramUserId}
                    value={String(poster.messages)}
                  />
                ))}
              </Group>
            )}
          </Section>

          <Section caption="Actividad reciente">
            {data.recentDays.length === 0 ? (
              <Empty
                icon="M"
                tone="gray"
                title="Sin datos de actividad todavia"
              />
            ) : (
              <Group>
                {data.recentDays.map((day) => (
                  <Row
                    key={day.day}
                    icon="M"
                    tone="teal"
                    title={day.day}
                    value={String(day.messages)}
                  />
                ))}
              </Group>
            )}
          </Section>

          <Section caption="Raid / spam por hora del dia">
            {peakHour && peakHour.count > 0 ? (
              <Banner>
                Hora con mas incidentes: {HOUR_LABELS[peakHour.hour]}:00 (
                {peakHour.count} eventos)
              </Banner>
            ) : (
              <Empty
                icon="R"
                tone="gray"
                title="Sin incidentes de raid o spam registrados"
              />
            )}
          </Section>

          <Section caption="Grupos sin configurar">
            {data.unconfiguredChats.length === 0 ? (
              <Empty
                icon="C"
                tone="teal"
                title="Todos los grupos estan configurados"
              />
            ) : (
              <Group>
                {data.unconfiguredChats.map((chat) => (
                  <Row
                    key={chat.chatId}
                    icon="C"
                    tone="orange"
                    title={chat.telegramChatId}
                    subtitle={[
                      chat.missingCaptcha && "sin captcha",
                      chat.missingAntiflood && "sin antiflood",
                      chat.missingWelcome && "sin bienvenida",
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  />
                ))}
              </Group>
            )}
          </Section>

          <Section caption="Doctor de red">
            {data.recommendations.length === 0 ? (
              <Empty
                icon="D"
                tone="teal"
                title="No hay recomendaciones pendientes"
              />
            ) : (
              <Group>
                {data.recommendations.map((rec) => (
                  <div className="network-role-row" key={rec.id}>
                    <div className="network-role-main">
                      <span>{rec.text}</span>
                    </div>
                    {autoFixableIds.has(rec.id) && (
                      <Button
                        variant="secondary"
                        disabled={busyFix !== null}
                        onClick={() => onFix(rec.id)}
                      >
                        {busyFix === rec.id ? "Aplicando..." : "Aplicar"}
                      </Button>
                    )}
                  </div>
                ))}
              </Group>
            )}
          </Section>
        </>
      )}
    </Screen>
  );
}

export default function AnalyticsPage() {
  return (
    <Suspense
      fallback={
        <Screen>
          <SkeletonList rows={4} />
        </Screen>
      }
    >
      <AnalyticsInner />
    </Suspense>
  );
}
