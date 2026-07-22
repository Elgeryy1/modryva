"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useState } from "react";
import {
  AppHeader,
  Banner,
  Button,
  Empty,
  Field,
  Group,
  Row,
  Screen,
  Section,
  SkeletonList,
  useBackButton,
} from "../../../components/ui";
import {
  addUserPanelNote,
  getUserPanelProfile,
  INTERNAL_ROLES,
  type InternalRole,
  setUserPanelRole,
  type UserPanelProfile,
} from "../../../lib/api-user-panel";
import { haptic, ready } from "../../../lib/telegram";

const ROLE_LABELS: Record<InternalRole, string> = {
  owner: "Propietario",
  network_manager: "Gestor de red",
  moderator: "Moderador",
  support: "Soporte",
  analyst: "Analista",
  read_only: "Solo lectura",
};

const ERROR_LABELS: Record<string, string> = {
  "invalid-telegram-user-id": "Ese ID de usuario no es valido.",
  "not-in-network": "Este grupo no pertenece a ninguna red.",
  "not-network-owner":
    "Solo el propietario de la red puede cambiar roles internos.",
  "invalid-body": "Los datos enviados no son validos.",
};

const humanError = (message: string): string =>
  ERROR_LABELS[message] ?? message;

function UsersInner() {
  const router = useRouter();
  const search = useSearchParams();
  const gid = search.get("gid") ?? "";

  const [searchId, setSearchId] = useState("");
  const [profile, setProfile] = useState<UserPanelProfile | null>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useBackButton(() => router.back());

  const load = useCallback(
    async (telegramUserId: string) => {
      if (!gid || !telegramUserId) {
        return;
      }
      ready();
      setBusy(true);
      setError(null);
      setNotice(null);
      try {
        const result = await getUserPanelProfile(gid, telegramUserId);
        setProfile(result);
        setNote("");
      } catch (e) {
        setError(humanError(e instanceof Error ? e.message : "error"));
        setProfile(null);
      } finally {
        setBusy(false);
      }
    },
    [gid],
  );

  const changeRole = async (role: InternalRole) => {
    if (!profile || busy) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await setUserPanelRole(gid, profile.telegramUserId, role);
      setProfile({ ...profile, internalRole: role });
      haptic.notify("success");
    } catch (e) {
      setError(humanError(e instanceof Error ? e.message : "error"));
      haptic.notify("error");
    } finally {
      setBusy(false);
    }
  };

  const saveNote = async () => {
    if (!profile || busy || note.trim().length === 0) {
      return;
    }
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const result = await addUserPanelNote(
        gid,
        profile.telegramUserId,
        note.trim(),
      );
      setNotice(
        result.persisted
          ? "Nota guardada."
          : "Nota registrada solo en esta sesion: todavia no hay almacen de notas.",
      );
      setNote("");
      haptic.notify("success");
    } catch (e) {
      setError(humanError(e instanceof Error ? e.message : "error"));
      haptic.notify("error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <AppHeader
        glyph="U"
        tone="purple"
        title="Panel de usuario"
        subtitle="Busca un usuario por su ID de Telegram"
      />

      {error && <Banner kind="error">{error}</Banner>}
      {notice && <Banner kind="success">{notice}</Banner>}

      <Section>
        <Field label="ID de Telegram">
          <input
            className="input"
            inputMode="numeric"
            value={searchId}
            onChange={(e) =>
              setSearchId(e.target.value.trim().replace(/[^\d]/gu, ""))
            }
            placeholder="123456789"
          />
        </Field>
        <Button
          variant="primary"
          block
          disabled={busy || searchId.length === 0}
          onClick={() => load(searchId)}
        >
          {busy ? "Buscando..." : "Buscar usuario"}
        </Button>
      </Section>

      {profile === null ? (
        <Empty
          icon="U"
          tone="purple"
          title="Ningun usuario cargado"
          hint="Introduce un ID de Telegram y pulsa buscar."
        />
      ) : (
        <>
          <Section caption="Perfil">
            <Group>
              <Row
                icon="U"
                tone="purple"
                title={profile.telegramUserId}
                subtitle={
                  profile.inNetwork
                    ? "Aparece en la red de este grupo"
                    : "Este grupo no pertenece a una red"
                }
              />
              <Row
                icon="W"
                tone="orange"
                title="Advertencias activas"
                value={String(profile.warnings.length)}
              />
              <Row
                icon="R"
                tone="red"
                title="Reportes como sujeto"
                value={String(profile.reports.length)}
              />
              {profile.risk && (
                <Row
                  icon="!"
                  tone="orange"
                  title="Puntuacion de riesgo"
                  value={String(profile.risk.score)}
                  subtitle={`borrados ${profile.risk.deletedCount} · reportes ${profile.risk.reportCount} · cuarentenas ${profile.risk.quarantineCount} · sanciones ${profile.risk.sanctionCount}`}
                />
              )}
              {!profile.risk && (
                <Row
                  icon="!"
                  tone="gray"
                  title="Riesgo no disponible"
                  subtitle="El modulo de riesgo de red no esta activo o el grupo no esta en una red."
                />
              )}
            </Group>
          </Section>

          {profile.warnings.length > 0 && (
            <Section caption="Advertencias">
              <Group>
                {profile.warnings.map((warning) => (
                  <Row
                    key={`${warning.createdAt}_${warning.reason ?? ""}`}
                    icon="W"
                    tone="orange"
                    title={warning.reason ?? "Sin motivo"}
                    subtitle={new Date(warning.createdAt).toLocaleString()}
                  />
                ))}
              </Group>
            </Section>
          )}

          {profile.reports.length > 0 && (
            <Section caption="Reportes">
              <Group>
                {profile.reports.map((report) => (
                  <Row
                    key={report.id}
                    icon="R"
                    tone="red"
                    title={report.reason ?? "Sin motivo"}
                    subtitle={`${report.status} · ${new Date(report.createdAt).toLocaleString()}`}
                  />
                ))}
              </Group>
            </Section>
          )}

          <Section caption="Rol interno">
            {profile.canManageRole ? (
              <Field
                label="Rol"
                hint="Solo controla el acceso al panel de la Mini App; no sustituye a ser admin real de Telegram."
              >
                <select
                  className="select"
                  value={profile.internalRole ?? ""}
                  onChange={(e) =>
                    e.target.value && changeRole(e.target.value as InternalRole)
                  }
                  disabled={busy}
                >
                  <option value="">Sin rol</option>
                  {INTERNAL_ROLES.map((role) => (
                    <option key={role} value={role}>
                      {ROLE_LABELS[role]}
                    </option>
                  ))}
                </select>
              </Field>
            ) : (
              <Row
                icon="i"
                tone="gray"
                title={
                  profile.internalRole
                    ? ROLE_LABELS[profile.internalRole]
                    : "Sin rol asignado"
                }
                subtitle="Solo el propietario de la red puede cambiar el rol interno de otro usuario."
              />
            )}
          </Section>

          <Section caption="Nota interna">
            <Field label="Nota de staff">
              <textarea
                className="textarea"
                rows={4}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Anotaciones visibles solo para el staff"
              />
            </Field>
            <Button
              variant="secondary"
              block
              disabled={busy || note.trim().length === 0}
              onClick={saveNote}
            >
              Guardar nota
            </Button>
          </Section>
        </>
      )}
    </Screen>
  );
}

export default function UsersPage() {
  return (
    <Suspense
      fallback={
        <Screen>
          <SkeletonList rows={4} />
        </Screen>
      }
    >
      <UsersInner />
    </Suspense>
  );
}
