"use client";

// Mini App mirror of the chat-native /help guide (apps/bot/src/core-handlers.ts
// `sections`). Same content, presented as a tap-to-expand list instead of a
// paginated chat menu — no group/auth context needed, so no API calls at all.

import { useEffect, useState } from "react";
import { AppHeader, Group, Row, Screen, Section } from "../../components/ui";
import { ready } from "../../lib/telegram";

interface HelpSection {
  id: string;
  icon: string;
  title: string;
  lines: readonly string[];
}

const SECTIONS: HelpSection[] = [
  {
    id: "moderation",
    icon: "🛡",
    title: "Moderación y sanciones",
    lines: [
      "Requiere que sea admin del grupo.",
      "🌐 Federaciones: /newfed /joinfed /leavefed /chatfed · /fban /unfban /fedstat · /fedadmins /fpromote /fdemote · /fedinfo /setfedlog /subfed /fedexport /fedimport",
      "/warn — avisar a un usuario (responde a su mensaje)",
      "/ban /unban — banear o readmitir",
      "/mute /unmute — silenciar (soporta duración: /mute 30m)",
      "/kick — expulsar sin banear",
      "/warnings /unwarn /resetwarn — gestionar avisos",
      "/purge <n> — borrar los últimos N mensajes",
      "/report — avisar a los admins",
    ],
  },
  {
    id: "antispam",
    icon: "🌊",
    title: "Antispam y protección",
    lines: [
      "💡 Todo esto también se configura con botones en ⚙️ /settings.",
      "/antiflood_on — activar control de flood",
      "/antiflood_limit <n> /antiflood_action — ajustar límite y castigo",
      "/antiraid_on /antiraid_mode — protección contra raids",
      "/captcha_on /captcha_mode /captcha_action — verificación de entrada",
      "/lock /unlock /locks — bloquear tipos de contenido (enlaces, media...)",
    ],
  },
  {
    id: "community",
    icon: "🎮",
    title: "Comunidad y contenido",
    lines: [
      "/save /get /notes /clear — notas del grupo (recupera con #nombre)",
      "/filter /filters /stop — respuestas automáticas",
      "/setwelcome /welcome /setrules /rules — bienvenida y reglas",
      "/rep /top /level — reputación y niveles por actividad",
      "/invites /inviters — referidos",
      "/stats /activity — estadísticas del grupo",
      "/afk [motivo] · /back — ausencias",
      "/poll /quiz /giveaway /gdraw /trivia — encuestas y juegos",
    ],
  },
  {
    id: "admin",
    icon: "👮",
    title: "Herramientas de admin",
    lines: [
      "⚙️ /settings — panel de configuración del grupo (bienvenida, antiflood, captcha, locks, antiraid) con botones, desde tu chat privado.",
      "/pin /unpin — fijar o liberar (responde al mensaje)",
      "/del — borrar el mensaje respondido",
      "/settitle <texto> /setdesc <texto> — título y descripción",
      "/promote [titulo] /demote — gestionar administradores",
      "/invitelink — nuevo enlace de invitación",
      "/admins — lista de administradores",
      "/addcmd /delcmd /cmds — comandos personalizados",
    ],
  },
  {
    id: "fun",
    icon: "🎲",
    title: "Diversión",
    lines: [
      "/q — convierte un mensaje en cita/sticker (responde con /q; /q png para imagen)",
      "/dice /dart /basket /soccer /bowling /slots — dados animados",
      "/roll 2d6 — tiradas clásicas",
      "/coin — cara o cruz",
      "/8ball <pregunta> — la bola mágica",
      "/rps — piedra, papel o tijera (con botones)",
      "/love nombre1 | nombre2 — compatibilidad",
      "/rate <algo> — puntuación 0-10",
    ],
  },
  {
    id: "utils",
    icon: "🧰",
    title: "Utilidades",
    lines: [
      "/calc <expresión> — calculadora (+ - * / % ^ y paréntesis)",
      "/id — tu ID, el del chat y el del mensaje",
      "/pick a | b | c — elige al azar",
      "/password [longitud] — contraseña segura",
      "/hash <texto> — sha256",
      "/b64 /unb64 — codificar/decodificar base64",
      "/reverse /len /upper /lower — trucos de texto",
    ],
  },
  {
    id: "tools",
    icon: "🤖",
    title: "IA y automatización",
    lines: [
      "En privado hablame sin comandos: respondo con IA.",
      "/ai <pregunta> — chat con IA",
      "/summarize — resumir un texto",
      "/translate <idioma> <texto> — traducir",
      "/aiforget — borrar la memoria de la conversación",
      "/rss add <url> — seguir un feed",
      "/webhook add <url> — webhooks salientes",
      "/remind <min> <texto> · /task /tasks — recordatorios y tareas",
      "/ticket /tickets — soporte",
    ],
  },
  {
    id: "pay",
    icon: "💳",
    title: "Pagos con Telegram Stars",
    lines: [
      "/products — catálogo de productos",
      "/buy <id> — comprar con Stars",
      "/addproduct — crear un producto (admins)",
    ],
  },
];

export default function HelpPage() {
  const [open, setOpen] = useState<string | null>(null);

  useEffect(() => {
    ready();
  }, []);

  return (
    <Screen>
      <AppHeader
        glyph="❓"
        tone="brand"
        title="Guía rápida"
        subtitle="Todo lo que Modryva sabe hacer, en un vistazo"
      />

      <Section caption="Primeros pasos">
        <Group>
          <Row
            icon="1️⃣"
            tone="blue"
            title="Añádeme a tu grupo"
            subtitle="Con el botón del menú principal del bot"
          />
          <Row icon="2️⃣" tone="blue" title="Dame permisos de administrador" />
          <Row
            icon="3️⃣"
            tone="blue"
            title="Activa lo que quieras"
            subtitle="/antiflood_on, /captcha_on, /setwelcome…"
          />
          <Row
            icon="4️⃣"
            tone="blue"
            title="Escribe cualquier comando"
            subtitle="Casi todos tienen ayuda si los usas mal"
          />
        </Group>
      </Section>

      <Section caption="Comandos por sección">
        <Group>
          {SECTIONS.map((section) => (
            <div key={section.id}>
              <Row
                icon={section.icon}
                tone="purple"
                title={section.title}
                subtitle={
                  open === section.id
                    ? "Toca para ocultar"
                    : `${section.lines.length} comandos`
                }
                chevron
                onClick={() => setOpen(open === section.id ? null : section.id)}
              />
              {open === section.id && (
                <div className="help-section-body">
                  {section.lines.map((line) => (
                    <p key={line} className="help-line">
                      {line}
                    </p>
                  ))}
                </div>
              )}
            </div>
          ))}
        </Group>
      </Section>
    </Screen>
  );
}
