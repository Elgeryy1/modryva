"use client";

import type { Route } from "next";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import {
  AppHeader,
  Banner,
  Empty,
  Group,
  Row,
  Screen,
  Section,
  SkeletonList,
  type Tone,
} from "../../components/ui";
import { postSession } from "../../lib/api";
import { decodeStartParam } from "../../lib/config-meta";
import { getStartParam, ready } from "../../lib/telegram";

// Human messages for the API's error codes — never show a raw code to the user.
const ERROR_LABELS: Record<string, string> = {
  "not-admin":
    "Solo los administradores del grupo pueden configurarlo. Si te acaban de dar admin, espera unos segundos y vuelve a abrirlo.",
  "chat-not-found":
    "No encuentro este grupo. Escribe /settings dentro del grupo para configurarlo.",
};
const humanError = (message: string): string =>
  ERROR_LABELS[message] ?? message;

interface ConfigSectionMeta {
  id: string;
  label: string;
  sub: string;
  icon: string;
  tone: Tone;
  // List sections (blocklist/filters) live on their own static routes; config
  // sections use the dynamic /config/<id> route built from the id.
  href?: string;
}

const OWNER: ConfigSectionMeta[] = [
  {
    id: "network",
    label: "Red de grupos",
    sub: "Controla logs, bienvenida y miembros en varios grupos",
    icon: "N",
    tone: "blue",
    href: "/config/network",
  },
  {
    id: "moderation-inbox",
    label: "Bandeja de moderación",
    sub: "Reportes, cuarentena, apelaciones y tickets en un solo lugar",
    icon: "📥",
    tone: "red",
    href: "/config/moderation",
  },
  {
    id: "tickets",
    label: "Tickets de soporte",
    sub: "Ábrelos con /ticket en el chat; gestiónalos y asígnalos aquí",
    icon: "🎫",
    tone: "teal",
    href: "/config/tickets",
  },
  {
    id: "notes",
    label: "Notas de staff",
    sub: "Bloc compartido del equipo con el contexto del grupo",
    icon: "📝",
    tone: "teal",
    href: "/config/notes",
  },
  {
    id: "wizard",
    label: "Asistente de configuración",
    sub: "Aplica un paquete de ajustes en un paso",
    icon: "🪄",
    tone: "purple",
    href: "/config/wizard",
  },
  {
    id: "risk",
    label: "Riesgo de la red",
    sub: "Usuarios con más incidencias en tus grupos",
    icon: "🚨",
    tone: "red",
    href: "/config/risk",
  },
  {
    id: "analytics",
    label: "Analíticas de red",
    sub: "Actividad, salud y recomendaciones de todos tus grupos",
    icon: "📊",
    tone: "teal",
    href: "/config/analytics",
  },
  {
    id: "insights",
    label: "Radar de miembros",
    sub: "Fantasmas (entraron y no escriben) y miembros inactivos",
    icon: "🛰️",
    tone: "purple",
    href: "/config/insights",
  },
  {
    id: "gamification",
    label: "Misiones y gamificación",
    sub: "Progreso, insignias y ranking de la comunidad",
    icon: "🏆",
    tone: "orange",
    href: "/config/gamification",
  },
  {
    id: "users",
    label: "Panel de usuario",
    sub: "Busca un usuario, revisa su historial y gestiona su rol interno",
    icon: "👤",
    tone: "purple",
    href: "/config/users",
  },
  {
    id: "automations",
    label: "Automatizaciones",
    sub: "Reglas visuales: si pasa esto, haz aquello",
    icon: "⚡",
    tone: "purple",
    href: "/config/automations",
  },
  {
    id: "panel",
    label: "Personalizar panel",
    sub: "Accesos rápidos, nombres de módulos, densidad y tono del bot",
    icon: "🎛️",
    tone: "blue",
    href: "/config/panel",
  },
  {
    id: "backup",
    label: "Copias de seguridad",
    sub: "Exporta, importa, clona o aplica una plantilla de negocio",
    icon: "💾",
    tone: "blue",
    href: "/config/backup",
  },
  {
    id: "premium",
    label: "Premium",
    sub: "Plan y límites de tu red de grupos",
    icon: "💎",
    tone: "orange",
    href: "/config/premium",
  },
  {
    id: "ai-pack",
    label: "Pack de IA",
    sub: "Activa la IA real en este grupo (30 ⭐/mes)",
    icon: "🤖",
    tone: "purple",
    href: "/config/ai-pack",
  },
];

// Two groups mirror how admins think about a group: who joins, and what's allowed.
const COMMUNITY: ConfigSectionMeta[] = [
  {
    id: "welcome",
    label: "Bienvenida",
    sub: "Saludo y despedida automáticos",
    icon: "👋",
    tone: "green",
  },
  {
    id: "rules",
    label: "Reglas",
    sub: "El texto que muestra /reglas",
    icon: "📋",
    tone: "blue",
  },
  {
    id: "rituals",
    label: "Rituales",
    sub: "Mensajes automáticos que se repiten cada semana",
    icon: "🔁",
    tone: "teal",
    href: "/config/rituals",
  },
  {
    id: "quiet",
    label: "Modo silencio",
    sub: "Que el bot no hable solo (subidas de nivel, etc.)",
    icon: "🔕",
    tone: "blue",
    href: "/config/quiet",
  },
  {
    id: "recap",
    label: "Recap semanal",
    sub: "Un resumen de la semana del grupo, cada lunes",
    icon: "🗓️",
    tone: "teal",
    href: "/config/recap",
  },
];
const MODERATION: ConfigSectionMeta[] = [
  {
    id: "behavior",
    label: "Comportamiento del bot",
    sub: "Modo pasivo: que el bot solo verifique y juegue, sin moderar",
    icon: "🎛️",
    tone: "blue",
  },
  {
    id: "flood",
    label: "Antiflood",
    sub: "Frena el spam por exceso de mensajes",
    icon: "🌊",
    tone: "teal",
  },
  {
    id: "raid",
    label: "Antiraid",
    sub: "Detecta oleadas de entradas y reacciona",
    icon: "🚨",
    tone: "red",
  },
  {
    id: "captcha",
    label: "Captcha",
    sub: "Verifica a los nuevos antes de escribir",
    icon: "🛡️",
    tone: "purple",
  },
  {
    id: "guardian",
    label: "Guardian Verification",
    sub: "Reto con cámara en Mini App antes de admitir solicitudes de entrada",
    icon: "🎥",
    tone: "blue",
    href: "/config/guardian",
  },
  {
    id: "locks",
    label: "Locks",
    sub: "Bloquea enlaces, stickers, reenvíos…",
    icon: "🔒",
    tone: "orange",
  },
  {
    id: "hygiene",
    label: "Limpieza y modo noche",
    sub: "Borra mensajes de servicio y silencia de noche",
    icon: "🌙",
    tone: "purple",
  },
  {
    id: "membershipGate",
    label: "Grupo requerido",
    sub: "Exige pertenecer a otro grupo para estar en este",
    icon: "🔗",
    tone: "blue",
  },
  {
    id: "federation",
    label: "Federación",
    sub: "Comparte baneos entre varios grupos",
    icon: "🌐",
    tone: "purple",
    href: "/config/federation",
  },
  {
    id: "filters",
    label: "Filtros",
    sub: "Respuestas automáticas a palabras clave",
    icon: "💬",
    tone: "teal",
    href: "/config/filters",
  },
  {
    id: "schedule-rules",
    label: "Ventanas estrictas",
    sub: "Modera más fuerte en ciertas horas del día",
    icon: "🕘",
    tone: "purple",
    href: "/config/schedule-rules",
  },
  {
    id: "reactions",
    label: "Moderación de reacciones",
    sub: "Retira reacciones con emojis vetados y avisa de brigadas",
    icon: "😠",
    tone: "orange",
    href: "/config/reactions",
  },
];

const SANCTIONS: ConfigSectionMeta[] = [
  {
    id: "warns",
    label: "Avisos",
    sub: "Cuántos avisos antes de sancionar",
    icon: "⚠️",
    tone: "orange",
  },
  {
    id: "blocklist",
    label: "Palabras prohibidas",
    sub: "Actúa cuando alguien las escribe",
    icon: "🚫",
    tone: "red",
    href: "/config/blocklist",
  },
];

type State =
  | { status: "loading" }
  | { status: "no-group" }
  | { status: "ready"; gid: string; title?: string; botName?: string }
  | { status: "error"; error: string };

function ConfigInner() {
  const search = useSearchParams();
  const [state, setState] = useState<State>({ status: "loading" });

  useEffect(() => {
    ready();
    const startParam = getStartParam();
    const decoded = decodeStartParam(startParam);
    // The group can arrive two ways: a `cfg_<gid>` deep link (start_param) or a
    // `?gid=` query — the latter is how we land here after the onboarding's
    // "moderate" step redirects (the start_param there is still `onb_<gid>`).
    const fromQuery = search.get("gid");
    const gid =
      fromQuery ??
      (decoded && "groupId" in decoded ? decoded.groupId : undefined);
    if (!gid) {
      setState({ status: "no-group" });
      return;
    }
    postSession(startParam)
      .then((res) =>
        setState({
          status: "ready",
          gid,
          ...(res.group?.title ? { title: res.group.title } : {}),
          ...(res.bot?.name ? { botName: res.bot.name } : {}),
        }),
      )
      .catch((e: Error) =>
        setState({ status: "error", error: humanError(e.message) }),
      );
  }, [search]);

  if (state.status === "loading") {
    return (
      <Screen>
        <AppHeader
          glyph="⚙️"
          tone="blue"
          title="Configuración"
          subtitle="Cargando el grupo…"
        />
        <SkeletonList rows={2} />
        <SkeletonList rows={3} />
      </Screen>
    );
  }

  if (state.status === "no-group") {
    return (
      <Screen>
        <Empty
          icon="⚙️"
          tone="blue"
          title="Ábrelo desde tu grupo"
          hint="Pulsa el botón ⚙️ Configurar dentro del grupo (o escribe /settings) para ajustar Modryva ahí."
        />
      </Screen>
    );
  }

  if (state.status === "error") {
    return (
      <Screen>
        <AppHeader glyph="⚙️" tone="blue" title="Configuración" />
        <Banner kind="error">{state.error}</Banner>
      </Screen>
    );
  }

  const groupFor = (items: ConfigSectionMeta[]) => (
    <Group>
      {items.map((m) => (
        <Row
          key={m.id}
          icon={m.icon}
          tone={m.tone}
          title={m.label}
          subtitle={m.sub}
          chevron
          href={`${m.href ?? `/config/${m.id}`}?gid=${state.gid}` as Route}
        />
      ))}
    </Group>
  );

  return (
    <Screen>
      <AppHeader
        glyph="⚙️"
        tone="blue"
        title={state.botName ?? "Configuración"}
        subtitle={
          state.title
            ? `Ajustes de ${state.title}`
            : "Elige qué quieres ajustar"
        }
      />
      <Section caption="Empieza aquí">
        <Group>
          <Row
            icon="✨"
            tone="brand"
            title="Propósito y juegos"
            subtitle="Elige para qué usas el bot y qué juegos activar"
            chevron
            href={`/config/onboarding?gid=${state.gid}` as Route}
          />
        </Group>
      </Section>
      <Section caption="Propietario">{groupFor(OWNER)}</Section>
      <Section caption="Comunidad">{groupFor(COMMUNITY)}</Section>
      <Section caption="Moderación">{groupFor(MODERATION)}</Section>
      <Section caption="Sanciones">{groupFor(SANCTIONS)}</Section>
    </Screen>
  );
}

export default function ConfigPage() {
  return (
    <Suspense
      fallback={
        <Screen>
          <SkeletonList rows={2} />
          <SkeletonList rows={3} />
        </Screen>
      }
    >
      <ConfigInner />
    </Suspense>
  );
}
