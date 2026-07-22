"use client";

import type { Route } from "next";
import type { FormEvent } from "react";
import { useCallback, useEffect, useState } from "react";
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
  type Tone,
} from "../../components/ui";
import {
  createPlatformAiCode,
  createPlatformPromo,
  grantCustomBot,
  type PlatformAiCode,
  type PlatformBotDetails,
  type PlatformMe,
  type PlatformPromo,
  platformAiCodes,
  platformBotDetails,
  platformMe,
  platformPromos,
  reactivateBot,
  sendPlatformBotMessage,
} from "../../lib/api";
import { ready } from "../../lib/telegram";

const REACTIVATE_REASONS: Record<string, string> = {
  "no-slot": "necesitas un acceso activo",
  "not-suspended": "el bot no esta pausado",
  "webhook-failed": "Telegram rechazo el webhook",
  "webhook-url-not-https": "la URL publica no esta lista",
};

const STATUS_LABEL: Record<string, string> = {
  active: "Activo",
  suspended: "Pausado",
  pending: "Activando",
  failed: "Error",
  revoked: "Revocado",
};

const STATUS_TONE: Record<string, Tone> = {
  active: "green",
  suspended: "orange",
  pending: "brand",
  failed: "red",
  revoked: "gray",
};

const TEMPLATES = ["community", "creator", "support", "business", "custom"];

type State =
  | { status: "loading" }
  | { status: "denied"; error: string }
  | {
      status: "ready";
      me: PlatformMe;
      promos: PlatformPromo[];
      aiCodes: PlatformAiCode[];
      createdCode?: string;
      createdAiCode?: string;
      message?: string;
      messageKind?: "success" | "error" | "info";
    };

type DetailState =
  | { status: "idle" }
  | { status: "loading"; username: string }
  | { status: "ready"; details: PlatformBotDetails }
  | { status: "error"; username: string; error: string };

const canManagePromos = (me: PlatformMe): boolean =>
  me.isOwner || me.roles.includes("promo_admin");

const canGrantBots = (me: PlatformMe): boolean =>
  me.isOwner || me.roles.includes("bot_factory_admin");

const canSeePlatform = (me: PlatformMe): boolean =>
  me.isOwner ||
  me.roles.length > 0 ||
  (me.bots?.length ?? 0) > 0 ||
  me.managedBotSlots > 0;

const statusLabel = (status: string): string => STATUS_LABEL[status] ?? status;

const configHref = (botUsername: string, telegramChatId: string): Route =>
  `/config?sp=cfg_${telegramChatId}&actas=${encodeURIComponent(botUsername)}` as Route;

export default function PlatformPage() {
  const [state, setState] = useState<State>({ status: "loading" });
  const [detail, setDetail] = useState<DetailState>({ status: "idle" });
  const [promoTemplate, setPromoTemplate] = useState("community");
  const [promoUses, setPromoUses] = useState(1);
  const [promoDays, setPromoDays] = useState(30);
  const [promoNote, setPromoNote] = useState("");
  const [grantUserId, setGrantUserId] = useState("");
  const [grantTemplate, setGrantTemplate] = useState("community");
  const [grantDays, setGrantDays] = useState(30);
  const [grantBusy, setGrantBusy] = useState(false);
  const [botBusy, setBotBusy] = useState<string | null>(null);
  const [senderUsername, setSenderUsername] = useState("");
  const [messageChatId, setMessageChatId] = useState("");
  const [messageText, setMessageText] = useState("");
  const [sendBusy, setSendBusy] = useState(false);
  const [aiCodeDays, setAiCodeDays] = useState(30);
  const [aiCodeNote, setAiCodeNote] = useState("");
  const [aiCodeBusy, setAiCodeBusy] = useState(false);

  const load = useCallback(async () => {
    const me = await platformMe();
    if (!canSeePlatform(me)) {
      setState({ status: "denied", error: "platform-access-denied" });
      return;
    }
    const promos = canManagePromos(me) ? (await platformPromos()).promos : [];
    const aiCodes = me.isOwner ? (await platformAiCodes()).codes : [];
    setState({ status: "ready", me, promos, aiCodes });
  }, []);

  useEffect(() => {
    ready();
    load().catch((error: Error) =>
      setState({ status: "denied", error: error.message }),
    );
  }, [load]);

  const openDetails = async (username: string) => {
    setDetail({ status: "loading", username });
    try {
      const details = await platformBotDetails(username);
      setDetail({ status: "ready", details });
      const firstChat = details.chats[0]?.telegramChatId;
      if (firstChat) {
        setMessageChatId(firstChat);
      }
      if (!senderUsername && details.bot.status === "active") {
        setSenderUsername(details.bot.username);
      }
    } catch (error) {
      setDetail({
        status: "error",
        username,
        error: error instanceof Error ? error.message : "No se pudo cargar.",
      });
    }
  };

  if (state.status === "loading") {
    return (
      <Screen>
        <AppHeader
          glyph="B"
          tone="teal"
          title="Plataforma"
          subtitle="Cargando"
        />
        <SkeletonList rows={3} />
      </Screen>
    );
  }

  if (state.status === "denied") {
    return (
      <Screen>
        <Empty
          icon="L"
          tone="gray"
          title="Sin acceso"
          hint="Esta seccion es para duenos de bots y administradores de plataforma."
        />
      </Screen>
    );
  }

  const submitPromo = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const result = await createPlatformPromo({
      template: promoTemplate,
      maxUses: promoUses,
      expiresInDays: promoDays,
      ...(promoNote ? { note: promoNote } : {}),
    });
    const promos = canManagePromos(state.me)
      ? (await platformPromos()).promos
      : [];
    setState({
      ...state,
      promos,
      createdCode: result.promo.code,
      message: "Promo creada.",
      messageKind: "success",
    });
  };

  const submitGrant = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setGrantBusy(true);
    try {
      await grantCustomBot({
        telegramUserId: grantUserId,
        template: grantTemplate,
        expiresInDays: grantDays,
      });
      setState({
        ...state,
        message: "Acceso concedido.",
        messageKind: "success",
      });
      setGrantUserId("");
    } catch (error) {
      setState({
        ...state,
        message:
          error instanceof Error
            ? `No se pudo conceder: ${error.message}`
            : "No se pudo conceder el acceso.",
        messageKind: "error",
      });
    } finally {
      setGrantBusy(false);
    }
  };

  const submitAiCode = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setAiCodeBusy(true);
    try {
      const result = await createPlatformAiCode({
        days: aiCodeDays,
        ...(aiCodeNote ? { note: aiCodeNote } : {}),
      });
      const aiCodes = (await platformAiCodes()).codes;
      setState({
        ...state,
        aiCodes,
        createdAiCode: result.code,
        message: "Código de IA creado.",
        messageKind: "success",
      });
      setAiCodeNote("");
    } catch (error) {
      setState({
        ...state,
        message:
          error instanceof Error
            ? `No se pudo crear el código: ${error.message}`
            : "No se pudo crear el código.",
        messageKind: "error",
      });
    } finally {
      setAiCodeBusy(false);
    }
  };

  const reactivate = async (username: string) => {
    setBotBusy(username);
    try {
      const result = await reactivateBot(username);
      const me = await platformMe();
      const promos = canManagePromos(me) ? (await platformPromos()).promos : [];
      setState({
        status: "ready",
        me,
        promos,
        aiCodes: state.aiCodes,
        message: result.ok
          ? `@${username} reactivado.`
          : `No se pudo reactivar @${username}: ${REACTIVATE_REASONS[result.reason ?? ""] ?? result.reason}`,
        messageKind: result.ok ? "success" : "error",
      });
    } catch (error) {
      setState({
        ...state,
        message:
          error instanceof Error ? error.message : "No se pudo reactivar.",
        messageKind: "error",
      });
    } finally {
      setBotBusy(null);
    }
  };

  const bots = state.me.bots ?? [];
  const senderOptions = state.me.isOwner
    ? [
        ...(state.me.primaryBot
          ? [
              {
                username: state.me.primaryBot.username,
                label: `${state.me.primaryBot.displayName} principal`,
              },
            ]
          : []),
        ...bots
          .filter((bot) => bot.status === "active")
          .map((bot) => ({
            username: bot.username,
            label: `@${bot.username}`,
          })),
      ]
    : [];

  const submitMessage = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const username = senderUsername || senderOptions[0]?.username;
    if (!username) {
      setState({
        ...state,
        message: "Elige un bot activo.",
        messageKind: "error",
      });
      return;
    }
    setSendBusy(true);
    try {
      await sendPlatformBotMessage(username, {
        chatId: messageChatId,
        text: messageText,
      });
      setState({
        ...state,
        message: `Mensaje enviado como @${username}.`,
        messageKind: "success",
      });
      setMessageText("");
    } catch (error) {
      setState({
        ...state,
        message: error instanceof Error ? error.message : "No se pudo enviar.",
        messageKind: "error",
      });
    } finally {
      setSendBusy(false);
    }
  };

  const subtitle = state.me.isOwner
    ? `Owner total · ${bots.length} bots hijos`
    : state.me.roles.length > 0
      ? `Roles: ${state.me.roles.join(", ")}`
      : "Tus bots personalizados";

  return (
    <Screen>
      <AppHeader
        glyph="B"
        tone="teal"
        title="Plataforma"
        subtitle={`${subtitle} · slots libres: ${state.me.managedBotSlots}`}
      />

      {state.message ? (
        <Banner kind={state.messageKind ?? "success"}>{state.message}</Banner>
      ) : null}

      {bots.length === 0 && state.me.managedBotSlots > 0 ? (
        <Empty
          icon="B"
          tone="teal"
          title={`Puedes crear ${state.me.managedBotSlots} bot(s)`}
          hint="Escribe /createbot en mi chat para empezar."
        />
      ) : null}

      <Section
        caption={state.me.isOwner ? "Bots creados por Modryva" : "Tus bots"}
      >
        {bots.length > 0 ? (
          <Group>
            {bots.map((bot) => (
              <Row
                key={bot.username}
                icon="B"
                tone={STATUS_TONE[bot.status] ?? "gray"}
                title={`@${bot.username}`}
                subtitle={
                  bot.ownerTelegramId
                    ? `Owner ${bot.ownerTelegramId}`
                    : bot.displayName
                }
                value={statusLabel(bot.status)}
                chevron
                onClick={() => openDetails(bot.username)}
              />
            ))}
          </Group>
        ) : (
          <Empty
            icon="B"
            tone="gray"
            title="Sin bots todavia"
            hint="Cuando alguien cree un bot desde Modryva aparecera aqui."
          />
        )}
      </Section>

      {detail.status === "loading" ? (
        <Section caption={`@${detail.username}`}>
          <SkeletonList rows={3} />
        </Section>
      ) : null}

      {detail.status === "error" ? (
        <Banner kind="error">{detail.error}</Banner>
      ) : null}

      {detail.status === "ready" ? (
        <>
          <Section caption={`Control de @${detail.details.bot.username}`}>
            <Group>
              <Row
                icon="B"
                tone={STATUS_TONE[detail.details.bot.status] ?? "gray"}
                title={detail.details.bot.displayName}
                subtitle={`Tenant ${detail.details.bot.tenantId}`}
                value={statusLabel(detail.details.bot.status)}
              />
              <Row
                icon="T"
                tone="purple"
                title="Telegram bot ID"
                subtitle={detail.details.bot.telegramBotId ?? "sin activar"}
              />
              {detail.details.bot.status === "active" ? (
                <>
                  <Row
                    icon="O"
                    tone="blue"
                    title={`Abrir @${detail.details.bot.username}`}
                    chevron
                    external
                    href={
                      `https://t.me/${detail.details.bot.username}` as Route
                    }
                  />
                  <Row
                    icon="+"
                    tone="green"
                    title="Anadir a un grupo"
                    subtitle="Con permisos de administrador"
                    chevron
                    external
                    href={
                      `https://t.me/${detail.details.bot.username}?startgroup=true&admin=change_info+delete_messages+restrict_members+pin_messages+manage_chat` as Route
                    }
                  />
                </>
              ) : detail.details.bot.status === "suspended" ? (
                <Row
                  icon="R"
                  tone="orange"
                  title={
                    botBusy === detail.details.bot.username
                      ? "Reactivando"
                      : "Reactivar bot"
                  }
                  disabled={botBusy === detail.details.bot.username}
                  onClick={() => reactivate(detail.details.bot.username)}
                />
              ) : null}
            </Group>
          </Section>

          <Section caption="Grupos vistos">
            {detail.details.chats.length > 0 ? (
              <Group>
                {detail.details.chats.map((chat) =>
                  state.me.isOwner ? (
                    <Row
                      key={chat.chatId}
                      icon="G"
                      tone="blue"
                      title={chat.title ?? chat.telegramChatId}
                      subtitle={chat.telegramChatId}
                      value={`${chat.memberCount}`}
                      chevron
                      href={configHref(
                        detail.details.bot.username,
                        chat.telegramChatId,
                      )}
                    />
                  ) : (
                    <Row
                      key={chat.chatId}
                      icon="G"
                      tone="blue"
                      title={chat.title ?? chat.telegramChatId}
                      subtitle={chat.telegramChatId}
                      value={`${chat.memberCount}`}
                    />
                  ),
                )}
              </Group>
            ) : (
              <Empty
                icon="G"
                tone="gray"
                title="Sin grupos registrados"
                hint="Cuando el bot vea actividad en grupos, saldran aqui."
              />
            )}
          </Section>
        </>
      ) : null}

      {state.me.isOwner && senderOptions.length > 0 ? (
        <form className="sec" onSubmit={submitMessage}>
          <Caption>Escribir como bot</Caption>
          <Field label="Bot">
            <select
              className="select"
              value={senderUsername || senderOptions[0]?.username}
              onChange={(event) => setSenderUsername(event.target.value)}
            >
              {senderOptions.map((option) => (
                <option key={option.username} value={option.username}>
                  {option.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Grupo / chat ID">
            <input
              className="input"
              inputMode="numeric"
              value={messageChatId}
              onChange={(event) => setMessageChatId(event.target.value)}
              placeholder="-100..."
              required
            />
          </Field>
          <Field label="Mensaje">
            <textarea
              className="textarea"
              value={messageText}
              onChange={(event) => setMessageText(event.target.value)}
              maxLength={4096}
              required
            />
          </Field>
          <Button type="submit" variant="primary" block disabled={sendBusy}>
            {sendBusy ? "Enviando" : "Enviar mensaje"}
          </Button>
        </form>
      ) : null}

      {state.createdCode ? (
        <Section caption="Codigo nuevo">
          <Group>
            <Row
              icon="C"
              tone="brand"
              title={<code className="code-value">{state.createdCode}</code>}
              subtitle="Copialo y compartelo"
            />
          </Group>
        </Section>
      ) : null}

      {state.me.isOwner ? (
        <>
          {state.createdAiCode ? (
            <Section caption="Código de IA nuevo">
              <Group>
                <Row
                  icon="I"
                  tone="brand"
                  title={
                    <code className="code-value">{state.createdAiCode}</code>
                  }
                  subtitle="Se canjea en el grupo con /aicode <código>"
                />
              </Group>
            </Section>
          ) : null}

          <form className="sec" onSubmit={submitAiCode}>
            <Caption>Dar acceso a la IA a un grupo</Caption>
            <Field label="Días de validez">
              <input
                className="input"
                min={1}
                max={3650}
                type="number"
                value={aiCodeDays}
                onChange={(event) => setAiCodeDays(Number(event.target.value))}
              />
            </Field>
            <Field label="Nota">
              <input
                className="input"
                type="text"
                value={aiCodeNote}
                onChange={(event) => setAiCodeNote(event.target.value)}
                placeholder="ej. grupo de pruebas de Dani"
              />
            </Field>
            <Button type="submit" variant="primary" block disabled={aiCodeBusy}>
              {aiCodeBusy ? "Creando" : "Crear código de IA"}
            </Button>
          </form>

          {state.aiCodes.length > 0 ? (
            <Section caption="Códigos de IA generados">
              <Group>
                {state.aiCodes.map((code) => (
                  <Row
                    key={code.codePrefix}
                    icon="I"
                    tone={code.redeemedByChatId ? "gray" : "brand"}
                    title={`${code.codePrefix}...`}
                    subtitle={
                      code.redeemedByChatId
                        ? `Canjeado por chat ${code.redeemedByChatId}`
                        : (code.note ?? `${code.days} dia(s)`)
                    }
                    value={code.redeemedByChatId ? "usado" : "libre"}
                  />
                ))}
              </Group>
            </Section>
          ) : null}
        </>
      ) : null}

      {canManagePromos(state.me) ? (
        <form className="sec" onSubmit={submitPromo}>
          <Caption>Crear promo</Caption>
          <Field label="Plantilla">
            <select
              className="select"
              value={promoTemplate}
              onChange={(event) => setPromoTemplate(event.target.value)}
            >
              {TEMPLATES.map((template) => (
                <option key={template} value={template}>
                  {template}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Usos">
            <input
              className="input"
              min={1}
              max={10000}
              type="number"
              value={promoUses}
              onChange={(event) => setPromoUses(Number(event.target.value))}
            />
          </Field>
          <Field label="Dias de validez">
            <input
              className="input"
              min={1}
              max={3650}
              type="number"
              value={promoDays}
              onChange={(event) => setPromoDays(Number(event.target.value))}
            />
          </Field>
          <Field label="Nota">
            <input
              className="input"
              type="text"
              value={promoNote}
              onChange={(event) => setPromoNote(event.target.value)}
            />
          </Field>
          <Button type="submit" variant="primary" block>
            Crear codigo
          </Button>
        </form>
      ) : null}

      {canGrantBots(state.me) ? (
        <form className="sec" onSubmit={submitGrant}>
          <Caption>Dar acceso directo</Caption>
          <Field label="Telegram user ID">
            <input
              className="input"
              inputMode="numeric"
              pattern="[0-9]*"
              value={grantUserId}
              onChange={(event) => setGrantUserId(event.target.value)}
              required
            />
          </Field>
          <Field label="Plantilla">
            <select
              className="select"
              value={grantTemplate}
              onChange={(event) => setGrantTemplate(event.target.value)}
            >
              {TEMPLATES.map((template) => (
                <option key={template} value={template}>
                  {template}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Dias de validez">
            <input
              className="input"
              min={1}
              max={3650}
              type="number"
              value={grantDays}
              onChange={(event) => setGrantDays(Number(event.target.value))}
            />
          </Field>
          <Button type="submit" variant="primary" block disabled={grantBusy}>
            {grantBusy ? "Concediendo" : "Conceder acceso"}
          </Button>
        </form>
      ) : null}

      {state.promos.length > 0 ? (
        <Section caption="Promos recientes">
          <Group>
            {state.promos.map((promo) => (
              <Row
                key={promo.id}
                icon="C"
                tone="brand"
                title={`${promo.codePrefix}...`}
                subtitle={promo.template}
                value={`${promo.usedCount}/${promo.maxUses}`}
              />
            ))}
          </Group>
        </Section>
      ) : null}
    </Screen>
  );
}
