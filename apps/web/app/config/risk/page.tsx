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
  type Tone,
  useBackButton,
} from "../../../components/ui";
import {
  getNetworkRisk,
  type NetworkRiskStatus,
  type RiskClassification,
  type RiskUserEntry,
  resetNetworkRiskProfile,
} from "../../../lib/api-risk";
import { haptic, ready } from "../../../lib/telegram";

const ERROR_LABELS: Record<string, string> = {
  "not-admin": "Solo los administradores del grupo pueden ver esta pantalla.",
  "not-in-network": "Este grupo no pertenece a ninguna red.",
  "not-network-admin":
    "Solo el propietario o un admin de la red puede ver y resetear el riesgo.",
  "invalid-user-id": "ID de usuario invalido.",
};

const humanError = (message: string): string =>
  ERROR_LABELS[message] ?? message;

const CLASSIFICATION_TONE: Record<RiskClassification, Tone> = {
  none: "gray",
  low: "teal",
  medium: "orange",
  high: "red",
};

const CLASSIFICATION_LABEL: Record<RiskClassification, string> = {
  none: "Sin riesgo",
  low: "Riesgo bajo",
  medium: "Riesgo medio",
  high: "Riesgo alto",
};

function RiskInner() {
  const router = useRouter();
  const search = useSearchParams();
  const gid = search.get("gid") ?? "";

  const [status, setStatus] = useState<NetworkRiskStatus | null>(null);
  const [busyUser, setBusyUser] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useBackButton(() => router.back());

  const load = useCallback(() => {
    if (!gid) {
      setError("Abre esta pantalla desde tu grupo.");
      setStatus({ inNetwork: false });
      return;
    }
    getNetworkRisk(gid)
      .then(setStatus)
      .catch((e: Error) => {
        setError(humanError(e.message));
        setStatus({ inNetwork: false });
      });
  }, [gid]);

  useEffect(() => {
    ready();
    load();
  }, [load]);

  const reset = useCallback(
    async (userId: string) => {
      if (busyUser) {
        return;
      }
      setBusyUser(userId);
      setError(null);
      setSaved(false);
      try {
        await resetNetworkRiskProfile(gid, userId);
        setSaved(true);
        haptic.notify("success");
        load();
      } catch (e) {
        setError(humanError(e instanceof Error ? e.message : "error"));
        haptic.notify("error");
      } finally {
        setBusyUser(null);
      }
    },
    [busyUser, gid, load],
  );

  const users: RiskUserEntry[] =
    status?.inNetwork && status.users ? status.users : [];

  return (
    <Screen>
      <AppHeader
        glyph="R"
        tone="red"
        title="Riesgo de la red"
        subtitle="Usuarios con más incidencias en tus grupos"
      />

      {error && <Banner kind="error">{error}</Banner>}
      {saved && <Banner kind="success">Perfil reseteado.</Banner>}

      {status === null ? (
        <SkeletonList rows={4} />
      ) : !status.inNetwork ? (
        <Empty
          icon="R"
          tone="red"
          title="Este grupo no esta en una red"
          hint="Une este grupo a una red desde 'Red de grupos' para ver el riesgo compartido."
        />
      ) : users.length === 0 ? (
        <Empty
          icon="R"
          tone="teal"
          title="Sin usuarios de riesgo todavia"
          hint="Aqui apareceran los usuarios con mensajes borrados, reportes, cuarentenas, enlaces o sanciones en tu red."
        />
      ) : (
        <Section caption="Usuarios con más riesgo">
          <Group>
            {users.map((user) => (
              <Row
                key={user.telegramUserId}
                icon="U"
                tone={CLASSIFICATION_TONE[user.classification]}
                title={user.telegramUserId}
                subtitle={[
                  `puntaje: ${user.score}`,
                  `borrados: ${user.deletedCount}`,
                  `reportes: ${user.reportCount}`,
                  `cuarentenas: ${user.quarantineCount}`,
                  `enlaces: ${user.linkCount}`,
                  `sanciones: ${user.sanctionCount}`,
                  `grupos: ${user.chatCount}`,
                ].join(" · ")}
                value={CLASSIFICATION_LABEL[user.classification]}
                trailing={
                  <Button
                    variant="secondary"
                    disabled={busyUser === user.telegramUserId}
                    onClick={(e) => {
                      e.stopPropagation();
                      void reset(user.telegramUserId);
                    }}
                  >
                    {busyUser === user.telegramUserId
                      ? "Reseteando..."
                      : "Resetear"}
                  </Button>
                }
              />
            ))}
          </Group>
        </Section>
      )}
    </Screen>
  );
}

export default function RiskPage() {
  return (
    <Suspense
      fallback={
        <Screen>
          <SkeletonList rows={4} />
        </Screen>
      }
    >
      <RiskInner />
    </Suspense>
  );
}
