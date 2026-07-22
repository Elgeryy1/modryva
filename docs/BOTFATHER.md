# BotFather — configuración esperada para Modryva IA

Este documento es la referencia operativa de cómo debe quedar configurado el bot en
@BotFather para que el flujo de IA (Inline Mode + Guest Chat Mode) funcione como
describe el código. **Los toggles de BotFather no se pueden leer ni cambiar por API
— esto es un checklist manual**, no una automatización.

## Estado esperado en BotFather

```
Inline Mode: ON
Inline Placeholder: 🤖 Preguntar a Modryva
Inline Location Data: OFF
Inline Feedback: 0%

Guest Chat Mode: ON
Bot Management Mode: ON
Guard Mode: ON

Secretary Mode: OFF por ahora
Bot to Bot Communication Mode: OFF por ahora
```

**Por qué:**
- **Inline Mode** se usa como buscador barato y cacheado (notas del grupo + un
  resultado de ayuda que apunta a `/ai`). Telegram manda una `inline_query` por
  cada letra tecleada, así que nunca debe llamar a la IA — ver
  `apps/bot/src/bot-update.service.ts` (`handleInlineQuery`).
- **Guest Chat Mode** es el flujo principal para usar IA en chats donde el bot no
  está añadido: el mensaje ya se envió completo (`guest_message`), así que sí
  puede llamar a la IA una vez (`handleGuestMessage`).
- **Guard Mode** se deja ON para el join-gate y las protecciones de grupo ya
  implementadas.
- **Bot Management Mode** se deja ON porque Modryva gestiona bots hijos
  (`managed_bot`) desde el bot padre.
- **Secretary Mode** y **Bot to Bot Communication Mode** quedan OFF hasta que se
  implementen permisos, anti-loop y auditoría específicos para esos modos — no
  hay código que los use todavía.

## Checklist manual paso a paso

1. Abrir @BotFather.
2. Seleccionar el bot de Modryva.
3. Entrar en **Bot Settings**.
4. **Inline Mode**:
   - Enable.
   - Placeholder: `🤖 Preguntar a Modryva`
   - Location Data: Disabled.
   - Feedback: 0%.
5. **Business / Mini App / Advanced Settings** (el nombre exacto puede variar
   según la versión de BotFather):
   - Guest Chat Mode: Enable.
   - Bot Management Mode: Enable.
   - Guard Mode: Enable si está disponible.
   - Secretary Mode: Disable.
   - Bot to Bot Communication Mode: Disable.
6. Guardar los cambios en BotFather.
7. Reiniciar el contenedor del bot (para que recoja cualquier cambio de env si
   se tocó algo).
8. Ejecutar `/aistatus` en privado como owner y comparar con la sección
   "Smoke test" de abajo.
9. Generar un código de acceso a IA en `/platform` (panel del owner) y
   canjearlo en cada grupo/chat que deba tener IA con `/aicode <código>` —
   sin esto, `/ai`, la mención al bot y el chat privado quedan bloqueados
   aunque `AI_ENABLED=1` (ver "Acceso a IA por código" en `docs/COMMANDS.md`).

## Comandos del bot (`/setcommands`)

El bot ya intenta fijar estos comandos automáticamente al arrancar (best-effort,
vía `setMyCommands` en `apps/bot/src/poller.ts`, solo en modo polling). Si por lo
que sea no se aplican (modo webhook sin ese paso, o falla silenciosamente), se
pueden pegar a mano en BotFather → `/setcommands`:

```
start - Iniciar Modryva
help - Ver ayuda
settings - Configurar grupo
ai - Preguntar a Modryva IA
summarize - Resumir texto
translate - Traducir texto
aiforget - Borrar memoria IA
aicode - Canjear código de acceso a IA
aipack - Ver o cancelar el pack de IA (Stars)
aistatus - Estado IA owner
aitest - Probar IA owner
```

Esto no bloquea el deploy: es solo la lista que aparece al pulsar "/" en el chat.

## Variables de entorno relevantes

Nombres reales usados por el repo (`packages/shared/src/env.ts`):

```dotenv
AI_ENABLED=1

AI_INLINE_USE_AI_DIRECTLY=0
AI_INLINE_CACHE_TTL_SECONDS=300
AI_INLINE_MIN_QUERY_CHARS=1

TELEGRAM_AI_GUEST_MODE_EXPECTED=1
TELEGRAM_AI_INLINE_MODE_EXPECTED=1

AI_GROQ_MODEL=llama-3.1-8b-instant
AI_OPENROUTER_MODEL=openrouter/free
AI_OPENROUTER_ALLOW_PAID_MODELS=0
```

Reglas que el código ya hace cumplir (`modules/ai/src/provider.ts`):
- Groq solo puede usar `llama-3.1-8b-instant` — cualquier modelo con `70b` en el
  nombre lanza un error al construir el proveedor.
- OpenRouter solo puede usar `openrouter/free` o un modelo terminado en `:free`,
  salvo que `AI_OPENROUTER_ALLOW_PAID_MODELS=1`.
- `AI_INLINE_USE_AI_DIRECTLY` está reservado para un futuro modo "responder
  inline con IA" explícitamente opt-in — hoy no hace nada, Inline Mode nunca
  llama a la IA pase lo que pase.

Ver `.env.example` para la lista completa (todas las claves reales, sin valores).

## `/aistatus` (owner-only)

Muestra, como mínimo:

```
IA: ON/OFF
Inline expected: ON/OFF
Inline cache: Xs
Inline direct AI: OFF
Guest expected: ON/OFF
supports_guest_queries: true/false/desconocido

Groq: N keys · modelo ...
Gemini: N proyectos · modelo ...
OpenRouter: modelo ... (ON/off)

Privacy mode: safe/normal/full
Cache: ON/OFF
```

`supports_guest_queries` se obtiene llamando a `getMe` en el momento — si
Telegram no lo reporta (versión antigua de la API, o la llamada falla), muestra
"desconocido" en vez de romper el comando.

**Nunca muestra:** valores de API keys, fragmentos de API keys, tokens de
Telegram, contenido de `.env` ni de ningún fichero de claves.

## Smoke test manual tras deploy

1. `/aistatus` en privado como owner.
   - Esperado: `IA: ON`, `Guest expected: ON`, `Inline expected: ON`,
     `Inline direct AI: OFF`, `supports_guest_queries` en `true` o
     "desconocido", sin secretos visibles.
2. `/ai di solo ok`
   - Esperado: si el chat NO tiene un código de acceso canjeado, responde
     "Este chat no tiene acceso a la IA todavía" sin llamar al proveedor.
     Genera un código en `/platform` (owner), canjéalo en el chat con
     `/aicode <código>`, y repite `/ai di solo ok`: ahora sí responde la IA;
     el proveedor/modelo solo se muestra si el comando lo hace de forma segura
     (`/aistatus`/`/aitest`, nunca claves).
3. `/translate en hi`
   - Esperado: traducción usando el router de IA.
4. `@ModryvaBot hola` (Inline Mode).
   - Esperado: aparece un resultado inline seleccionable, se puede mandar, y
     **no** se llama a la IA (no gasta cuota de Groq/Gemini/OpenRouter).
5. Mencionar al bot en un chat donde no está añadido (Guest Chat Mode).
   - Esperado: Telegram entrega `guest_message`, el bot responde vía
     `answerGuestQuery` (nunca `sendMessage`), sí puede usar IA si
     `AI_ENABLED=1`, y corta el pipeline (sin postprocessors).
6. Revisar logs del contenedor.
   - Esperado: sin API keys, sin contenido de ficheros de claves, sin tokens de
     Telegram, sin prompts sensibles completos.

## Verificación rápida del contrato Inline / Guest

```
inline_query
→ answerInlineQuery
→ mínimo 1 resultado
→ cacheTime/cache_time (AI_INLINE_CACHE_TTL_SECONDS)
→ NO aiProvider.complete
→ STOP (sin postprocessors)

guest_message
→ sanitize
→ aiProvider.complete solo si AI_ENABLED=1
→ answerGuestQuery
→ NO sendMessage
→ STOP (sin postprocessors)
```

Implementado en `apps/bot/src/bot-update.service.ts`
(`processWebhookScoped`, `handleInlineQuery`, `handleGuestMessage`).
