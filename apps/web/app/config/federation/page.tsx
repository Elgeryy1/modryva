"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useState } from "react";
import {
  AppHeader,
  Banner,
  Button,
  Caption,
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
  addFedAdmin,
  addFedBan,
  clearFederationSubscription,
  createFederation,
  deleteFederation,
  type FederationStatus,
  getFederationStatus,
  joinFederation,
  leaveFederation,
  removeFedAdmin,
  removeFedBan,
  renameFederation,
  setFederationSubscription,
} from "../../../lib/api";
import { haptic, ready } from "../../../lib/telegram";

function FederationInner() {
  const router = useRouter();
  const search = useSearchParams();
  const gid = search.get("gid") ?? "";

  const [status, setStatus] = useState<FederationStatus | null>(null);
  const [name, setName] = useState("");
  const [fedId, setFedId] = useState("");
  const [banUserId, setBanUserId] = useState("");
  const [banReason, setBanReason] = useState("");
  const [renameValue, setRenameValue] = useState("");
  const [subFedId, setSubFedId] = useState("");
  const [newAdminId, setNewAdminId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useBackButton(() => router.back());

  const load = useCallback(() => {
    if (!gid) {
      setError("Abre esta pantalla desde tu grupo.");
      setStatus({ inFederation: false });
      return;
    }
    getFederationStatus(gid)
      .then(setStatus)
      .catch((e: Error) => {
        setError(e.message);
        setStatus({ inFederation: false });
      });
  }, [gid]);

  useEffect(() => {
    ready();
    load();
  }, [load]);

  const onCreate = useCallback(async () => {
    const trimmed = name.trim();
    if (!trimmed || busy) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      setStatus(await createFederation(gid, trimmed));
      setName("");
      haptic.notify("success");
    } catch (e) {
      setError(e instanceof Error ? e.message : "error");
      haptic.notify("error");
    } finally {
      setBusy(false);
    }
  }, [gid, name, busy]);

  const onJoin = useCallback(async () => {
    const trimmed = fedId.trim();
    if (!trimmed || busy) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      setStatus(await joinFederation(gid, trimmed));
      setFedId("");
      haptic.notify("success");
    } catch (e) {
      setError(
        e instanceof Error && e.message === "federation-not-found"
          ? "No existe una federación con ese ID."
          : e instanceof Error
            ? e.message
            : "error",
      );
      haptic.notify("error");
    } finally {
      setBusy(false);
    }
  }, [gid, fedId, busy]);

  const onLeave = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      setStatus(await leaveFederation(gid));
      haptic.notify("success");
    } catch (e) {
      setError(e instanceof Error ? e.message : "error");
      haptic.notify("error");
    } finally {
      setBusy(false);
    }
  }, [gid]);

  const onBan = useCallback(async () => {
    const trimmed = banUserId.trim();
    if (!trimmed || busy) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      setStatus(await addFedBan(gid, trimmed, banReason.trim() || undefined));
      setBanUserId("");
      setBanReason("");
      haptic.notify("success");
    } catch (e) {
      setError(e instanceof Error ? e.message : "error");
      haptic.notify("error");
    } finally {
      setBusy(false);
    }
  }, [gid, banUserId, banReason, busy]);

  const onUnban = useCallback(
    async (userId: string) => {
      setBusy(true);
      setError(null);
      try {
        setStatus(await removeFedBan(gid, userId));
        haptic.notify("success");
      } catch (e) {
        setError(e instanceof Error ? e.message : "error");
        haptic.notify("error");
      } finally {
        setBusy(false);
      }
    },
    [gid],
  );

  const onAddAdmin = useCallback(async () => {
    const trimmed = newAdminId.trim();
    if (!trimmed || busy) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      setStatus(await addFedAdmin(gid, trimmed));
      setNewAdminId("");
      haptic.notify("success");
    } catch (e) {
      setError(e instanceof Error ? e.message : "error");
      haptic.notify("error");
    } finally {
      setBusy(false);
    }
  }, [gid, newAdminId, busy]);

  const onRemoveAdmin = useCallback(
    async (id: string) => {
      setBusy(true);
      setError(null);
      try {
        setStatus(await removeFedAdmin(gid, id));
        haptic.notify("success");
      } catch (e) {
        setError(e instanceof Error ? e.message : "error");
        haptic.notify("error");
      } finally {
        setBusy(false);
      }
    },
    [gid],
  );

  const onRename = useCallback(async () => {
    const trimmed = renameValue.trim();
    if (!trimmed || busy) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      setStatus(await renameFederation(gid, trimmed));
      setRenameValue("");
      haptic.notify("success");
    } catch (e) {
      setError(e instanceof Error ? e.message : "error");
      haptic.notify("error");
    } finally {
      setBusy(false);
    }
  }, [gid, renameValue, busy]);

  const onDeleteFederation = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      setStatus(await deleteFederation(gid));
      haptic.notify("success");
    } catch (e) {
      setError(e instanceof Error ? e.message : "error");
      haptic.notify("error");
    } finally {
      setBusy(false);
    }
  }, [gid]);

  const onSetSubscription = useCallback(async () => {
    const trimmed = subFedId.trim();
    if (!trimmed || busy) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      setStatus(await setFederationSubscription(gid, trimmed));
      setSubFedId("");
      haptic.notify("success");
    } catch (e) {
      setError(e instanceof Error ? e.message : "error");
      haptic.notify("error");
    } finally {
      setBusy(false);
    }
  }, [gid, subFedId, busy]);

  const onClearSubscription = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      setStatus(await clearFederationSubscription(gid));
      haptic.notify("success");
    } catch (e) {
      setError(e instanceof Error ? e.message : "error");
      haptic.notify("error");
    } finally {
      setBusy(false);
    }
  }, [gid]);

  return (
    <Screen>
      <AppHeader
        glyph="🌐"
        tone="purple"
        title="Federación"
        subtitle="Comparte baneos entre varios grupos"
      />

      {error && <Banner kind="error">{error}</Banner>}

      {status === null ? (
        <SkeletonList rows={3} />
      ) : status.inFederation ? (
        <>
          <Group>
            <Row
              icon="🌐"
              tone="purple"
              title={status.name}
              subtitle={
                status.isOwner
                  ? "Eres el dueño de esta federación"
                  : status.isFedAdmin
                    ? "Eres admin de esta federación"
                    : "Grupo vinculado"
              }
            />
            <Row
              icon="👥"
              tone="blue"
              title="Grupos"
              value={String(status.chatCount)}
            />
            <Row
              icon="🔨"
              tone="red"
              title="Baneados"
              value={String(status.banCount)}
            />
          </Group>

          <Section caption="ID para vincular otros grupos">
            <p className="code-value">{status.fedId}</p>
          </Section>

          {status.chats && (
            <Section caption="Grupos vinculados">
              {status.chats.length === 0 ? (
                <Empty
                  icon="👥"
                  tone="blue"
                  title="Sin grupos vinculados"
                  hint="Solo este grupo pertenece a la federación."
                />
              ) : (
                <Group>
                  {status.chats.map((c) => (
                    <Row
                      key={c.telegramChatId}
                      icon="👥"
                      tone="blue"
                      title={c.title ?? c.telegramChatId}
                      {...(c.title ? { subtitle: c.telegramChatId } : {})}
                    />
                  ))}
                </Group>
              )}
            </Section>
          )}

          {status.bans && (
            <Section caption="Baneados en la federación">
              {status.bans.length === 0 ? (
                <Empty
                  icon="🔨"
                  tone="red"
                  title="Sin baneados"
                  hint="Usa /fban en cualquier grupo de la federación."
                />
              ) : (
                <Group>
                  {status.bans.map((b) => (
                    <Row
                      key={b.telegramUserId}
                      icon="🔨"
                      tone="red"
                      title={b.telegramUserId}
                      {...(b.reason ? { subtitle: b.reason } : {})}
                      trailing={
                        <Button
                          variant="ghost"
                          aria-label={`Desbanear ${b.telegramUserId}`}
                          onClick={() => onUnban(b.telegramUserId)}
                        >
                          ×
                        </Button>
                      }
                    />
                  ))}
                </Group>
              )}
            </Section>
          )}

          {status.isFedAdmin && (
            <Section caption="Banear a alguien">
              <Field label="ID de usuario de Telegram">
                <input
                  className="input"
                  value={banUserId}
                  onChange={(e) => setBanUserId(e.target.value)}
                  placeholder="123456789"
                />
              </Field>
              <Field label="Motivo (opcional)">
                <input
                  className="input"
                  value={banReason}
                  onChange={(e) => setBanReason(e.target.value)}
                  placeholder="Por qué se banea"
                />
              </Field>
              <Button
                variant="danger"
                block
                disabled={busy || banUserId.trim().length === 0}
                onClick={onBan}
              >
                {busy ? "Baneando…" : "Banear"}
              </Button>
            </Section>
          )}

          {status.admins && (
            <Section caption="Admins de la federación">
              {status.admins.length === 0 ? (
                <Empty
                  icon="👑"
                  tone="purple"
                  title="Sin admins adicionales"
                  hint="Solo el dueño gestiona la federación por ahora."
                />
              ) : (
                <Group>
                  {status.admins.map((id) => (
                    <Row
                      key={id}
                      icon="👑"
                      tone="purple"
                      title={id}
                      {...(status.isOwner
                        ? {
                            trailing: (
                              <Button
                                variant="ghost"
                                aria-label={`Quitar admin ${id}`}
                                onClick={() => onRemoveAdmin(id)}
                              >
                                ×
                              </Button>
                            ),
                          }
                        : {})}
                    />
                  ))}
                </Group>
              )}
              {status.isOwner && (
                <>
                  <Field label="Añadir admin (ID de usuario)">
                    <input
                      className="input"
                      value={newAdminId}
                      onChange={(e) => setNewAdminId(e.target.value)}
                      placeholder="123456789"
                    />
                  </Field>
                  <Button
                    variant="secondary"
                    block
                    disabled={busy || newAdminId.trim().length === 0}
                    onClick={onAddAdmin}
                  >
                    {busy ? "Añadiendo…" : "Añadir admin"}
                  </Button>
                </>
              )}
            </Section>
          )}

          {status.isOwner && (
            <Section caption="Renombrar">
              <Field label="Nuevo nombre">
                <input
                  className="input"
                  value={renameValue}
                  onChange={(e) => setRenameValue(e.target.value)}
                  placeholder={status.name}
                />
              </Field>
              <Button
                variant="secondary"
                block
                disabled={busy || renameValue.trim().length === 0}
                onClick={onRename}
              >
                {busy ? "Guardando…" : "Renombrar federación"}
              </Button>

              <Caption>Zona peligrosa</Caption>
              <Button
                variant="danger"
                block
                disabled={busy}
                onClick={onDeleteFederation}
              >
                {busy ? "Eliminando…" : "Eliminar federación por completo"}
              </Button>
            </Section>
          )}

          {status.isOwner && (
            <Section caption="Federación de la que hereda baneos">
              {status.subscribedFedId ? (
                <>
                  <Row icon="🔗" tone="teal" title={status.subscribedFedId} />
                  <Button
                    variant="ghost"
                    block
                    disabled={busy}
                    onClick={onClearSubscription}
                  >
                    Quitar suscripción
                  </Button>
                </>
              ) : (
                <>
                  <Empty
                    icon="🔗"
                    tone="teal"
                    title="No hereda baneos de ninguna otra"
                  />
                  <Field label="ID de la federación de la que heredar">
                    <input
                      className="input"
                      value={subFedId}
                      onChange={(e) => setSubFedId(e.target.value)}
                      placeholder="Pégalo aquí"
                    />
                  </Field>
                  <Button
                    variant="secondary"
                    block
                    disabled={busy || subFedId.trim().length === 0}
                    onClick={onSetSubscription}
                  >
                    {busy ? "Guardando…" : "Suscribirse"}
                  </Button>
                </>
              )}
            </Section>
          )}

          <Button variant="danger" block disabled={busy} onClick={onLeave}>
            {busy ? "Saliendo…" : "Salir de la federación"}
          </Button>
        </>
      ) : (
        <>
          <Empty
            icon="🌐"
            tone="purple"
            title="Este grupo no está en ninguna federación"
            hint="Crea una nueva o únete a una existente con su ID."
          />

          <Section caption="Crear una federación">
            <Field
              label="Nombre"
              hint="Este grupo se vinculará automáticamente."
            >
              <input
                className="input"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="p. ej. Mi Red de Grupos"
              />
            </Field>
            <Button
              variant="primary"
              block
              disabled={busy || name.trim().length === 0}
              onClick={onCreate}
            >
              {busy ? "Creando…" : "Crear federación"}
            </Button>
          </Section>

          <Section caption="Unirse a una existente">
            <Field label="ID de la federación">
              <input
                className="input"
                value={fedId}
                onChange={(e) => setFedId(e.target.value)}
                placeholder="Pégalo aquí"
              />
            </Field>
            <Button
              variant="secondary"
              block
              disabled={busy || fedId.trim().length === 0}
              onClick={onJoin}
            >
              {busy ? "Uniendo…" : "Unirse"}
            </Button>
          </Section>
        </>
      )}
    </Screen>
  );
}

export default function FederationPage() {
  return (
    <Suspense
      fallback={
        <Screen>
          <SkeletonList rows={3} />
        </Screen>
      }
    >
      <FederationInner />
    </Suspense>
  );
}
