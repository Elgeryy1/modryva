"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useState } from "react";
import {
  AppHeader,
  Banner,
  Button,
  Empty,
  Field,
  Group,
  MultiToggleRow,
  RouteRow,
  Row,
  Screen,
  Section,
  Segmented,
  SkeletonList,
  useBackButton,
} from "../../../components/ui";
import {
  createOwnerNetwork,
  getOwnerNetworkStatus,
  joinOwnerNetwork,
  leaveOwnerNetwork,
  type OwnerNetworkGroupRole,
  type OwnerNetworkGroupRouting,
  type OwnerNetworkPolicy,
  type OwnerNetworkRouteEntry,
  type OwnerNetworkRouteEventKind,
  type OwnerNetworkStatus,
  renameOwnerNetwork,
  rollbackOwnerNetwork,
  updateOwnerNetworkRouting,
  updateOwnerNetworkSettings,
} from "../../../lib/api";
import { haptic, ready } from "../../../lib/telegram";

const DEFAULT_POLICY: OwnerNetworkPolicy = {
  logTelegramChatId: null,
  welcomeMode: "per_group",
  welcomeText: null,
  goodbyeText: null,
  rulesMode: "per_group",
  rulesText: null,
  membershipMode: "off",
};

const TEXT_MODE_OPTIONS = [
  { value: "per_group", label: "Cada grupo" },
  { value: "global", label: "Misma para todos" },
] as const;

const MEMBERSHIP_OPTIONS = [
  { value: "off", label: "Libre" },
  { value: "require_all", label: "Mismos en todos" },
] as const;

const ROLE_OPTIONS: ReadonlyArray<{
  value: OwnerNetworkGroupRole;
  label: string;
  hint: string;
}> = [
  { value: "staff", label: "Staff", hint: "reportes y alertas" },
  { value: "logs", label: "Logs", hint: "registro del bot" },
  { value: "support", label: "Soporte", hint: "tickets y ayuda" },
  { value: "announcements", label: "Avisos", hint: "solo anuncios" },
  { value: "archive", label: "Archivo", hint: "historial" },
];

const ROLE_LABELS: Record<OwnerNetworkGroupRole, string> = {
  staff: "Staff",
  logs: "Logs",
  support: "Soporte",
  announcements: "Avisos",
  archive: "Archivo",
};

const DESTINATION_PRESETS: ReadonlyArray<{
  id: string;
  label: string;
  hint: string;
  emptyLabel: string;
  eventKinds: readonly OwnerNetworkRouteEventKind[];
}> = [
  {
    id: "reports",
    label: "Reportes",
    hint: "Cuando alguien reporta un mensaje o pide revision.",
    emptyLabel: "No enviar reportes",
    eventKinds: ["reports", "appeals"],
  },
  {
    id: "alerts",
    label: "Alertas importantes",
    hint: "Raids, spam fuerte y usuarios en cuarentena.",
    emptyLabel: "No enviar alertas",
    eventKinds: ["raid_alerts", "spam_alerts", "quarantine"],
  },
  {
    id: "logs",
    label: "Registro del bot",
    hint: "Cambios de moderacion y actividad del bot.",
    emptyLabel: "No enviar registro",
    eventKinds: ["logs", "moderation_actions"],
  },
  {
    id: "support",
    label: "Soporte",
    hint: "Tickets y conversaciones de ayuda.",
    emptyLabel: "No enviar soporte",
    eventKinds: ["tickets"],
  },
];

const ERROR_LABELS: Record<string, string> = {
  "already-in-network": "Este grupo ya pertenece a una red.",
  "duplicate-route": "Hay dos destinos repetidos para lo mismo.",
  "invalid-name": "Pon un nombre valido para la red.",
  "invalid-network-id": "Pega un ID de red valido.",
  "route-chat-not-in-network": "Elige grupos que ya esten unidos a esta red.",
  "network-not-found": "No existe una red con ese ID.",
  "not-in-network": "Este grupo no pertenece a ninguna red.",
  "not-network-admin":
    "Solo el propietario o un admin de la red puede aplicar cambios globales.",
  "no-snapshot": "Todavia no hay ningun cambio masivo que deshacer.",
};

const MIXED_DESTINATION = "__mixed";

const humanError = (message: string): string =>
  ERROR_LABELS[message] ?? message;

function NetworkInner() {
  const router = useRouter();
  const search = useSearchParams();
  const gid = search.get("gid") ?? "";

  const [status, setStatus] = useState<OwnerNetworkStatus | null>(null);
  const [draft, setDraft] = useState<OwnerNetworkPolicy>(DEFAULT_POLICY);
  const [roleDraft, setRoleDraft] = useState<OwnerNetworkGroupRouting[]>([]);
  const [routeDraft, setRouteDraft] = useState<OwnerNetworkRouteEntry[]>([]);
  const [name, setName] = useState("");
  const [networkId, setNetworkId] = useState("");
  const [renameValue, setRenameValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useBackButton(() => router.back());

  const applyStatus = useCallback((next: OwnerNetworkStatus) => {
    setStatus(next);
    if (next.inNetwork) {
      setDraft(next.policy);
      setRoleDraft(next.roles ?? []);
      setRouteDraft(next.routes ?? []);
      setRenameValue("");
    }
  }, []);

  const load = useCallback(() => {
    if (!gid) {
      setError("Abre esta pantalla desde tu grupo.");
      setStatus({ inNetwork: false });
      return;
    }
    getOwnerNetworkStatus(gid)
      .then(applyStatus)
      .catch((e: Error) => {
        setError(humanError(e.message));
        setStatus({ inNetwork: false });
      });
  }, [gid, applyStatus]);

  useEffect(() => {
    ready();
    load();
  }, [load]);

  const run = useCallback(
    async (task: () => Promise<OwnerNetworkStatus>) => {
      if (busy) {
        return;
      }
      setBusy(true);
      setError(null);
      setSaved(false);
      try {
        applyStatus(await task());
        setSaved(true);
        haptic.notify("success");
      } catch (e) {
        setError(humanError(e instanceof Error ? e.message : "error"));
        haptic.notify("error");
      } finally {
        setBusy(false);
      }
    },
    [busy, applyStatus],
  );

  const setPolicy = (patch: Partial<OwnerNetworkPolicy>) =>
    setDraft((prev) => ({ ...prev, ...patch }));

  const currentChat =
    status?.inNetwork && status.chats
      ? status.chats.find((chat) => chat.telegramChatId === gid)
      : undefined;

  const rolesFor = (chatId: string): OwnerNetworkGroupRole[] =>
    roleDraft.find((entry) => entry.chatId === chatId)?.roles ?? [];

  const formatRoles = (roles?: readonly OwnerNetworkGroupRole[]): string =>
    roles && roles.length > 0
      ? roles.map((role) => ROLE_LABELS[role]).join(", ")
      : "Sin funcion especial";

  const toggleRole = (
    chatId: string,
    role: OwnerNetworkGroupRole,
    enabled: boolean,
  ) => {
    setRoleDraft((prev) => {
      const current = prev.find((entry) => entry.chatId === chatId);
      const nextRoles = new Set(current?.roles ?? []);
      if (enabled) {
        nextRoles.add(role);
      } else {
        nextRoles.delete(role);
      }
      const rest = prev.filter((entry) => entry.chatId !== chatId);
      if (nextRoles.size === 0) {
        return rest;
      }
      return [
        ...rest,
        {
          chatId,
          roles: [...nextRoles],
          label: current?.label ?? null,
        },
      ];
    });
  };

  const routeValue = (
    sourceChatId: string | null,
    eventKind: OwnerNetworkRouteEventKind,
  ): string =>
    routeDraft.find(
      (route) =>
        route.sourceChatId === sourceChatId && route.eventKind === eventKind,
    )?.targetChatId ?? "";

  const destinationValue = (
    sourceChatId: string | null,
    eventKinds: readonly OwnerNetworkRouteEventKind[],
  ): string => {
    const values = [
      ...new Set(
        eventKinds
          .map((eventKind) => routeValue(sourceChatId, eventKind))
          .filter((value): value is string => value.length > 0),
      ),
    ];
    if (values.length === 0) {
      return "";
    }
    return values.length === 1 ? (values[0] ?? "") : MIXED_DESTINATION;
  };

  const setDestination = (
    sourceChatId: string | null,
    eventKinds: readonly OwnerNetworkRouteEventKind[],
    targetChatId: string,
  ) => {
    setRouteDraft((prev) => {
      const eventSet = new Set(eventKinds);
      const rest = prev.filter(
        (route) =>
          !(
            route.sourceChatId === sourceChatId && eventSet.has(route.eventKind)
          ),
      );
      if (!targetChatId || targetChatId === MIXED_DESTINATION) {
        return rest;
      }
      return [
        ...rest,
        ...eventKinds.map((eventKind) => ({
          sourceChatId,
          eventKind,
          targetChatId,
          enabled: true,
        })),
      ];
    });
  };

  const firstGroupWithRole = (role: OwnerNetworkGroupRole): string =>
    roleDraft.find((entry) => entry.roles.includes(role))?.chatId ?? "";

  const fillDestinationsFromRoles = () => {
    const staffChatId = firstGroupWithRole("staff");
    const logsChatId = firstGroupWithRole("logs") || staffChatId;
    const supportChatId = firstGroupWithRole("support") || staffChatId;
    if (!staffChatId && !logsChatId && !supportChatId) {
      setError("Marca primero un grupo como Staff, Logs o Soporte.");
      return;
    }

    const targetByPreset: Record<string, string> = {
      reports: staffChatId,
      alerts: staffChatId,
      logs: logsChatId,
      support: supportChatId,
    };
    const presetKinds = new Set(
      DESTINATION_PRESETS.flatMap((preset) => preset.eventKinds),
    );
    setRouteDraft((prev) => {
      const rest = prev.filter(
        (route) =>
          route.sourceChatId !== null || !presetKinds.has(route.eventKind),
      );
      const next = DESTINATION_PRESETS.flatMap((preset) => {
        const targetChatId = targetByPreset[preset.id];
        return targetChatId
          ? preset.eventKinds.map((eventKind) => ({
              sourceChatId: null,
              eventKind,
              targetChatId,
              enabled: true,
            }))
          : [];
      });
      return [...rest, ...next];
    });
    setSaved(false);
    setError(null);
  };

  return (
    <Screen>
      <AppHeader
        glyph="N"
        tone="blue"
        title="Red de grupos"
        subtitle="Gestiona varios grupos desde este panel"
      />

      {error && <Banner kind="error">{error}</Banner>}
      {saved && <Banner kind="success">Cambios aplicados.</Banner>}

      {status === null ? (
        <SkeletonList rows={4} />
      ) : status.inNetwork ? (
        <>
          <Group>
            <Row
              icon="N"
              tone="blue"
              title={status.name}
              subtitle={
                status.isOwner
                  ? "Eres el propietario de esta red"
                  : status.isNetworkAdmin
                    ? "Puedes gestionar esta red"
                    : "Grupo unido a una red"
              }
            />
            <Row
              icon="G"
              tone="teal"
              title="Grupos conectados"
              value={String(status.chatCount)}
            />
            <Row
              icon="A"
              tone="purple"
              title="Admins de red"
              value={String(status.adminCount)}
            />
          </Group>

          <Section caption="ID para unir otros grupos">
            <p className="code-value">{status.networkId}</p>
          </Section>

          {status.chats && (
            <Section caption="Grupos de la red">
              <Group>
                {status.chats.map((chat) => (
                  <Row
                    key={chat.telegramChatId}
                    icon="G"
                    tone={chat.status === "misaligned" ? "orange" : "teal"}
                    title={chat.title ?? chat.telegramChatId}
                    subtitle={[
                      formatRoles(chat.roles),
                      chat.requiredGroupCount > 0
                        ? `${chat.requiredGroupCount} grupos obligatorios`
                        : "Entrada libre",
                      chat.logTelegramChatId
                        ? "Logs D1 configurados"
                        : "Sin logs D1",
                    ].join(" - ")}
                    value={
                      chat.status === "misaligned"
                        ? `Desalineado (${chat.misalignedFields?.join(", ")})`
                        : "Alineado"
                    }
                  />
                ))}
              </Group>
            </Section>
          )}

          {status.isNetworkAdmin && (
            <Section caption="Seguridad de red">
              <Group>
                <Row
                  icon="S"
                  tone={status.lastSnapshot ? "teal" : "gray"}
                  title={
                    status.lastSnapshot
                      ? "Ultimo cambio masivo guardado"
                      : "Sin cambios masivos todavia"
                  }
                  subtitle={
                    status.lastSnapshot
                      ? `${status.lastSnapshot.reason} - ${new Date(status.lastSnapshot.createdAt).toLocaleString()}`
                      : "Cada vez que apliques cambios a toda la red se guarda una copia automatica."
                  }
                />
              </Group>
              <Button
                variant="secondary"
                block
                disabled={busy || !status.lastSnapshot}
                onClick={() => run(() => rollbackOwnerNetwork(gid))}
              >
                {busy ? "Deshaciendo..." : "Deshacer ultimo cambio masivo"}
              </Button>
            </Section>
          )}

          {!status.isNetworkAdmin && (
            <Banner>
              Puedes ver la red, pero los cambios globales los aplica el
              propietario o un admin de red.
            </Banner>
          )}

          {status.isNetworkAdmin && (
            <>
              {status.chats && (
                <Section caption="Que es cada grupo">
                  <Banner>
                    Marca para que sirve cada grupo. Por ejemplo: el grupo de
                    staff recibe reportes, el de logs recibe actividad del bot.
                  </Banner>
                  <Group>
                    {status.chats.map((chat) => (
                      <MultiToggleRow
                        key={chat.chatId}
                        title={chat.title ?? chat.telegramChatId}
                        subtitle={chat.telegramChatId}
                        options={ROLE_OPTIONS}
                        selected={rolesFor(chat.chatId)}
                        onToggle={(role, enabled) =>
                          toggleRole(chat.chatId, role, enabled)
                        }
                      />
                    ))}
                  </Group>
                </Section>
              )}

              {status.chats && status.chats.length > 0 && (
                <Section caption="Donde va cada cosa">
                  <Banner>
                    Elige a que grupo se enviara cada tipo de aviso. Si ya has
                    marcado Staff, Logs o Soporte, puedes rellenarlo solo.
                  </Banner>
                  <Button
                    variant="secondary"
                    block
                    disabled={busy}
                    onClick={fillDestinationsFromRoles}
                  >
                    Usar grupos Staff / Logs / Soporte
                  </Button>
                  <Group>
                    {DESTINATION_PRESETS.map((preset) => (
                      <RouteRow
                        key={preset.id}
                        label={preset.label}
                        hint={preset.hint}
                        value={destinationValue(null, preset.eventKinds)}
                        mixedValue={MIXED_DESTINATION}
                        emptyLabel={preset.emptyLabel}
                        options={
                          status.chats?.map((chat) => ({
                            value: chat.chatId,
                            label: chat.title ?? chat.telegramChatId,
                          })) ?? []
                        }
                        onChange={(next) =>
                          setDestination(null, preset.eventKinds, next)
                        }
                      />
                    ))}
                  </Group>
                </Section>
              )}

              {status.chats && currentChat && (
                <Section caption="Excepciones de este grupo">
                  <Banner>
                    Normalmente este grupo usa los destinos de arriba. Cambia
                    algo aqui solo si este grupo debe enviar avisos a otro
                    sitio.
                  </Banner>
                  <Group>
                    {DESTINATION_PRESETS.map((preset) => (
                      <RouteRow
                        key={preset.id}
                        label={preset.label}
                        hint="Usar destino general o elegir otro."
                        value={destinationValue(
                          currentChat.chatId,
                          preset.eventKinds,
                        )}
                        mixedValue={MIXED_DESTINATION}
                        emptyLabel="Usar destino de la red"
                        options={
                          status.chats?.map((chat) => ({
                            value: chat.chatId,
                            label: chat.title ?? chat.telegramChatId,
                          })) ?? []
                        }
                        onChange={(next) =>
                          setDestination(
                            currentChat.chatId,
                            preset.eventKinds,
                            next,
                          )
                        }
                      />
                    ))}
                  </Group>
                </Section>
              )}

              {status.chats && status.chats.length > 0 && (
                <Button
                  variant="primary"
                  block
                  disabled={busy}
                  onClick={() =>
                    run(() =>
                      updateOwnerNetworkRouting(gid, {
                        roles: roleDraft,
                        routes: routeDraft,
                      }),
                    )
                  }
                >
                  {busy ? "Guardando..." : "Guardar destinos y grupos"}
                </Button>
              )}

              <Section caption="Logs centralizados">
                <Field
                  label="Grupo o canal de logs"
                  hint="El bot enviara los eventos D1 de todos los grupos a este chat. Dejalo vacio para desactivar logs D1 en la red."
                >
                  <input
                    className="input"
                    inputMode="numeric"
                    value={draft.logTelegramChatId ?? ""}
                    onChange={(e) => {
                      const next = e.target.value
                        .trim()
                        .replace(/[^-\d]/gu, "");
                      setPolicy({
                        logTelegramChatId: next === "" ? null : next,
                      });
                    }}
                    placeholder="-1001234567890"
                  />
                </Field>
                <Button
                  variant="secondary"
                  block
                  disabled={busy}
                  onClick={() => setPolicy({ logTelegramChatId: gid })}
                >
                  Usar este grupo como logs
                </Button>
              </Section>

              <Section caption="Bienvenida">
                <Field label="Modo">
                  <Segmented
                    options={TEXT_MODE_OPTIONS}
                    value={draft.welcomeMode}
                    onChange={(welcomeMode) => setPolicy({ welcomeMode })}
                  />
                </Field>
                {draft.welcomeMode === "global" && (
                  <>
                    <Field
                      label="Mensaje global"
                      hint="Se copiara a todos los grupos de la red."
                    >
                      <textarea
                        className="textarea"
                        rows={4}
                        value={draft.welcomeText ?? ""}
                        onChange={(e) =>
                          setPolicy({
                            welcomeText:
                              e.target.value === "" ? null : e.target.value,
                          })
                        }
                        placeholder="Hola {first_name}, bienvenido a {chat_title}"
                      />
                    </Field>
                    <Field label="Despedida global">
                      <textarea
                        className="textarea"
                        rows={3}
                        value={draft.goodbyeText ?? ""}
                        onChange={(e) =>
                          setPolicy({
                            goodbyeText:
                              e.target.value === "" ? null : e.target.value,
                          })
                        }
                        placeholder="Hasta pronto {first_name}"
                      />
                    </Field>
                  </>
                )}
              </Section>

              <Section caption="Reglas">
                <Field label="Modo">
                  <Segmented
                    options={TEXT_MODE_OPTIONS}
                    value={draft.rulesMode}
                    onChange={(rulesMode) => setPolicy({ rulesMode })}
                  />
                </Field>
                {draft.rulesMode === "global" && (
                  <Field
                    label="Reglas globales"
                    hint="Se copiaran a todos los grupos conectados."
                  >
                    <textarea
                      className="textarea"
                      rows={6}
                      value={draft.rulesText ?? ""}
                      onChange={(e) =>
                        setPolicy({
                          rulesText:
                            e.target.value === "" ? null : e.target.value,
                        })
                      }
                      placeholder="1. Respeta a todos&#10;2. Nada de spam"
                    />
                  </Field>
                )}
              </Section>

              <Section caption="Miembros">
                <Field
                  label="Acceso"
                  hint="Si eliges mismos en todos, quien participe aqui tambien tendra que estar en los demas grupos de la red. El bot debe ser admin en todos."
                >
                  <Segmented
                    options={MEMBERSHIP_OPTIONS}
                    value={draft.membershipMode}
                    onChange={(membershipMode) => setPolicy({ membershipMode })}
                  />
                </Field>
              </Section>

              <Button
                variant="primary"
                block
                disabled={busy}
                onClick={() =>
                  run(() => updateOwnerNetworkSettings(gid, draft))
                }
              >
                {busy ? "Aplicando..." : "Guardar y aplicar a la red"}
              </Button>

              <Section caption="Nombre">
                <Field label="Renombrar red">
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
                  onClick={() =>
                    run(() => renameOwnerNetwork(gid, renameValue.trim()))
                  }
                >
                  Renombrar
                </Button>
              </Section>
            </>
          )}

          <Button
            variant="danger"
            block
            disabled={busy}
            onClick={() => run(() => leaveOwnerNetwork(gid))}
          >
            Sacar este grupo de la red
          </Button>
        </>
      ) : (
        <>
          <Empty
            icon="N"
            tone="blue"
            title="Este grupo no esta en una red"
            hint="Crea una red privada o une este grupo con el ID que te da otro grupo."
          />

          <Section caption="Crear red">
            <Field label="Nombre">
              <input
                className="input"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Mis grupos"
              />
            </Field>
            <Button
              variant="primary"
              block
              disabled={busy || name.trim().length === 0}
              onClick={() => run(() => createOwnerNetwork(gid, name.trim()))}
            >
              {busy ? "Creando..." : "Crear red"}
            </Button>
          </Section>

          <Section caption="Unir a una red">
            <Field label="ID de red">
              <input
                className="input"
                value={networkId}
                onChange={(e) => setNetworkId(e.target.value)}
                placeholder="Pega el ID aqui"
              />
            </Field>
            <Button
              variant="secondary"
              block
              disabled={busy || networkId.trim().length === 0}
              onClick={() => run(() => joinOwnerNetwork(gid, networkId.trim()))}
            >
              {busy ? "Uniendo..." : "Unir grupo"}
            </Button>
          </Section>
        </>
      )}
    </Screen>
  );
}

export default function NetworkPage() {
  return (
    <Suspense
      fallback={
        <Screen>
          <SkeletonList rows={4} />
        </Screen>
      }
    >
      <NetworkInner />
    </Suspense>
  );
}
