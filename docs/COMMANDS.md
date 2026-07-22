# Comandos

Estado de los comandos realmente implementados y conectados (parser + handler + persistencia
+ auditoria + tests). Los comandos no listados aqui aun no estan implementados.

## Core (Fase 0.2)

| Comando    | Ambito   | Descripcion                          |
| ---------- | -------- | ------------------------------------ |
| `/start`   | todos    | Mensaje de bienvenida + menu inline. |
| `/help`    | todos    | Ayuda base.                          |
| `/menu`    | todos    | Menu principal.                      |
| `/settings`| todos    | Placeholder de ajustes.              |
| `/status`  | todos    | Estado de la fundacion.              |
| `/cancel`  | todos    | Cancela el flujo actual.             |

## Plataforma owner

Solo el `SUPERBOT_OWNER_TELEGRAM_ID` puede ejecutar estos comandos.

| Comando       | Ambito | Descripcion                                      |
| ------------- | ------ | ------------------------------------------------ |
| `/banbotuser` | owner  | Banea a un usuario de bot, Mini App y bots hijos. |
| `/unbanbotuser` | owner | Revoca un ban global activo.                    |
| `/checkbotban` | owner | Muestra el ban activo de un usuario.            |
| `/botbans`    | owner  | Lista hasta 50 baneos globales activos.         |

Uso: `/banbotuser <telegram_id> [tiempo: 30m|2h|7d|4w] [motivo]`.
Sin tiempo, el ban es permanente. El owner configurado no se puede banear.

## Moderacion (Fase 1.1 - 1.2)

| Comando | Permiso            | Descripcion                                             |
| ------- | ------------------ | ------------------------------------------------------- |
| `/warn`   | moderation.write | Crea caso + warning persistente.                  |
| `/ban`    | moderation.write | Sancion ban + `banChatMember` via Gateway.        |
| `/mute`   | moderation.write | Sancion mute temporal + `restrictChatMember`.     |
| `/unban`  | moderation.write | `unbanChatMember` + revierte sanciones ban activas. |
| `/unmute` | moderation.write | `liftRestrictions` + revierte sanciones mute activas. |
| `/kick`   | moderation.write | Expulsa (ban + unban inmediato), sin ban persistente. |

Uso: `/warn <telegram_user_id> [motivo]`, `/ban <id> [motivo]`,
`/mute <id> <10m|2h|7d> [motivo]`, `/unban <id> [motivo]`, `/unmute <id> [motivo]`,
`/kick <id> [motivo]`.

### Moderacion avanzada (Fase 1.4)

| Comando       | Permiso          | Descripcion                                         |
| ------------- | ---------------- | --------------------------------------------------- |
| `/warnings`   | moderation.write | Lista los avisos activos de un usuario.             |
| `/unwarn`     | moderation.write | Retira el aviso activo mas reciente.                |
| `/resetwarn`  | moderation.write | Retira todos los avisos activos del usuario.        |
| `/purge`      | moderation.write | `/purge <1..100>` borra los ultimos N mensajes.     |
| `/report`     | —                | `/report <id> [motivo]` registra un reporte.        |

`/purge` borra por rango de message_id (best-effort, ignora los >48h). `/report` lo puede usar
cualquier miembro y queda en `Report` para revision. Avisos persisten en `Warning` (expiredAt).

## Antiflood (Fase 1.3)

| Comando              | Permiso       | Descripcion                                  |
| -------------------- | ------------- | -------------------------------------------- |
| `/antiflood`         | —             | Ayuda del modulo.                            |
| `/antiflood_status`  | —             | Muestra configuracion actual.                |
| `/antiflood_test`    | —             | Simula el limite sin sancionar.              |
| `/antiflood_on`      | config.write  | Activa antiflood en el chat.                 |
| `/antiflood_off`     | config.write  | Desactiva antiflood.                         |
| `/antiflood_limit`   | config.write  | `/antiflood_limit <mensajes> [ventana_seg]`. |
| `/antiflood_action`  | config.write  | `<ignore\|delete\|warn\|mute\|ban>`.         |

## CAPTCHA (Fase 1.3)

| Comando             | Permiso       | Descripcion                              |
| ------------------- | ------------- | ---------------------------------------- |
| `/captcha`          | —             | Ayuda del modulo.                        |
| `/captcha_status`   | —             | Configuracion actual.                    |
| `/captcha_test`     | —             | Genera un reto de ejemplo.               |
| `/captcha_on/off`   | config.write  | Activa/desactiva captcha de entrada.     |
| `/captcha_mode`     | config.write  | `<button\|math\|text>`.                  |
| `/captcha_timeout`  | config.write  | Segundos hasta expirar (>=10).           |
| `/captcha_attempts` | config.write  | Numero maximo de intentos.               |
| `/captcha_action`   | config.write  | Accion al fallar `<ban\|mute\|restrict>`.|

El reto se emite automaticamente a los nuevos miembros; se resuelve por boton (callback) o
por mensaje de texto. Al resolver se levantan las restricciones; al agotar intentos o expirar
(via worker) se aplica la accion de fallo.

## Guardian Verification (join request queries, Bot API 10.1)

| Comando            | Permiso       | Descripcion                                          |
| ------------------- | ------------- | ---------------------------------------------------- |
| `/guardian`          | —             | Ayuda del modulo.                                     |
| `/guardian_status`   | —             | Configuracion actual (modo, intentos, STAFF).         |
| `/guardian_on/off`   | guardian.config | Activa/desactiva (exige STAFF configurado primero). |
| `/guardian_mode`     | guardian.config | `<off\|manual\|assisted\|auto\|strict>`.              |

Cuando esta activado y la solicitud de entrada trae `query_id` (Bot API 10.1), Modryva crea una
sesion de verificacion, abre una Mini App con reto de camara via `sendChatJoinRequestWebApp` y
resuelve la solicitud (`approve`/`decline`/`queue`) segun el motor de decision tras el analisis.
Sin `query_id` (Bot API antigua) o sin Guardian activado, se mantiene el comportamiento previo
(auto-aprobar si esta configurado, o dejar la solicitud pendiente en la UI nativa de Telegram).
Configuracion completa (chat STAFF, umbrales, dificultad, retencion) en la Mini App
`/config/guardian`. Ver `docs/GUARDIAN_TELEGRAM_TEST.md` para la puesta a punto con un bot real.

## Content locks (Fase 1.4)

| Comando   | Permiso       | Descripcion                                  |
| --------- | ------------- | -------------------------------------------- |
| `/locks`  | —             | Lista los tipos bloqueados en el chat.       |
| `/lock`   | config.write  | `/lock <tipo...>` bloquea uno o varios tipos.|
| `/unlock` | config.write  | `/unlock <tipo...>` desbloquea tipos.        |

Tipos soportados: `text, url, mention, forward, via_bot, photo, video, gif, sticker, audio,
voice, document, contact, location, poll`. Cuando un miembro (no admin) envia un mensaje con
un tipo bloqueado, el mensaje se elimina (`deleteMessage`) y se audita el evento.

## Antiraid (Fase 1.4)

| Comando            | Permiso       | Descripcion                                  |
| ------------------ | ------------- | -------------------------------------------- |
| `/antiraid`        | —             | Ayuda del modulo.                            |
| `/antiraid_status` | —             | Configuracion actual.                        |
| `/antiraid_test`   | —             | Simula una oleada de entradas.               |
| `/antiraid_on/off` | config.write  | Activa/desactiva la deteccion de oleadas.    |
| `/antiraid_limit`  | config.write  | `/antiraid_limit <entradas> [ventana_seg]`.  |
| `/antiraid_mode`   | config.write  | `<observe\|enforce>`.                        |

Cuenta las entradas de nuevos miembros en una ventana deslizante (contador compartido). Al
superar el umbral registra un `AntiraidEvent`, marca el chat "under attack" y, en modo
`enforce`, restringe a los nuevos miembros; en modo `observe` solo alerta y audita.

## Notas (Fase 2)

| Comando  | Permiso      | Descripcion                                   |
| -------- | ------------ | --------------------------------------------- |
| `/save`  | config.write | `/save <nombre> <contenido>` guarda una nota. |
| `/get`   | —            | `/get <nombre>` devuelve la nota.             |
| `/notes` | —            | Lista las notas del chat.                     |
| `/clear` | config.write | `/clear <nombre>` elimina una nota.           |

Tambien se puede recuperar una nota escribiendo `#<nombre>` como mensaje suelto.

## Filtros (Fase 2)

| Comando    | Permiso      | Descripcion                                     |
| ---------- | ------------ | ----------------------------------------------- |
| `/filter`  | config.write | `/filter <palabra> <respuesta>` crea un filtro. |
| `/filters` | —            | Lista los filtros del chat.                     |
| `/stop`    | config.write | `/stop <palabra>` elimina un filtro.            |

Cuando un mensaje contiene una palabra-filtro (coincidencia por palabra completa,
insensible a mayusculas), el bot responde automaticamente con la respuesta asociada.

## Comandos personalizados (Fase 2)

| Comando   | Permiso      | Descripcion                                       |
| --------- | ------------ | ------------------------------------------------- |
| `/addcmd` | config.write | `/addcmd <nombre> <respuesta>` crea un comando.   |
| `/delcmd` | config.write | `/delcmd <nombre>` elimina un comando.            |
| `/cmds`   | —            | Lista los comandos personalizados del chat.       |

El nombre se normaliza (minusculas, sin `/`), debe casar `^[a-z0-9_]{1,32}$` y no puede pisar un
comando reservado. Cuando llega un `/<nombre>` desconocido se busca en `CustomCommand` y se responde.

## Notas: export/import (Fase 2)

| Comando   | Permiso      | Descripcion                                          |
| --------- | ------------ | ---------------------------------------------------- |
| `/export` | —            | Devuelve todas las notas del chat en JSON.           |
| `/import` | config.write | `/import <json>` carga notas (formato de `/export`). |

`/import` valida el JSON de forma segura (rechaza datos malformados, cap 200 notas). Ademas, las
auto-respuestas de filtros tienen un cooldown de 30s por trigger.

## Inline mode (Fase 3)

El bot responde a consultas inline (`@bot <texto>`) con las notas del tenant cuyo nombre o contenido
coincide (`answerInlineQuery`, articulos con `input_message_content`). Auditado como `inline.answered`.
Nunca llama a la IA por consulta inline (Telegram manda una por cada letra tecleada): si no hay notas
que encajen, o la consulta es demasiado corta (`AI_INLINE_MIN_QUERY_CHARS`), responde con un resultado
fijo que apunta a `/ai`, para que Telegram siempre tenga al menos un resultado seleccionable. El
`cache_time` de la respuesta es configurable via `AI_INLINE_CACHE_TTL_SECONDS`.

Guest Chat Mode (`guest_message`) es distinto: ahi el mensaje ya fue enviado completo, asi que el bot
si puede usar IA real (si `AI_ENABLED=1`) y responde con `answerGuestQuery`, nunca con `sendMessage`.
Ese modo solo aplica a grupos donde el bot NO esta anadido; requiere un gesto especifico del cliente
de Telegram (no basta con escribir `@bot texto` y enviarlo, eso resuelve como inline_query normal).

## Acceso a IA por codigo (control de cuota)

`AI_ENABLED=1` es el interruptor global, pero para evitar que cualquier grupo agote la cuota
compartida (Groq/Gemini/OpenRouter), cada chat (grupo o privado) necesita ademas un codigo de acceso
canjeado. Sin codigo, `/ai`, `/summarize`, `/translate`, la mencion al bot y el chat privado responden
"Este chat no tiene acceso a la IA todavia" sin llamar al proveedor.

- El creador del bot genera codigos desde el panel `/platform` (Mini App, solo owner) o via
  `POST /v1/platform/ai-codes` (`{ days, note? }`).
- Cualquiera en el chat los canjea con `/aicode <codigo>` — un codigo es de un solo uso y da acceso
  a ESE chat durante los dias configurados al crearlo.
- El estado se guarda en `AiAccessCode`/`AiChatAccess` (`packages/data/src/ai-access-repository.ts`),
  independiente de los repos de entitlements de federacion o de creacion de bots.

## Pack de IA (suscripcion Stars, 30/mes)

Alternativa a los codigos: pagar con Telegram Stars desde el apartado dedicado de IA en la Mini App
(`/config/ai-pack`, o `/config/ai-pack?gid=<grupo>` desde el panel de un grupo). Es una suscripcion
real de Telegram (`createInvoiceLink` con `subscription_period`): se cobra cada 30 dias sola, sin que
el usuario tenga que volver a comprar.

Dos alcances, segun desde donde se compra:

- **Grupo** (`ai_pack:chat:<chatId>`): solo un admin del grupo puede comprarlo desde el panel de ese
  grupo; desbloquea la IA para TODO el grupo. Equivale a canjear un `/aicode`, pero se renueva sola.
- **Personal** (`ai_pack:user:<telegramUserId>`): se compra desde el chat privado con el bot; solo
  desbloquea la IA para esa persona, mencione al bot o escriba donde escriba (grupo o DM), aunque ese
  chat en concreto no tenga codigo ni suscripcion propia.

El pago llega siempre como `successful_payment` en el chat privado del pagador con el bot (asi
funciona el sistema de pagos de Telegram), por eso el chat/usuario objetivo va codificado en el
payload de la factura, no se deduce del chat donde llega el pago.

`/aipack` muestra el estado (activo/cancelado, fecha de renovacion) y, con `/aipack cancelar`, detiene
la renovacion (en grupo, solo un admin puede cancelar). Cancelar NO revoca el periodo ya pagado — la
IA sigue disponible hasta que termine, luego no se renueva. Internamente llama a
`editUserStarSubscription` para que Telegram deje de cobrar.

Via Inline Mode, la IA real solo se activa con pack/código activo Y una consulta de al menos 12
caracteres (para no disparar la IA en cada tecla mientras compones la frase).

En un grupo donde el bot YA es miembro, mencionarlo en un mensaje normal (`@bot que tal`) tambien
dispara IA real (si `AI_ENABLED=1`), sin necesidad de `/ai` — ver `extractMentionPrompt` en
`modules/ai/src/mention-chat.ts` y `handleMentionChat` en `bot-update.service.ts`.

## Bienvenida y reglas (Fase 2)

| Comando         | Permiso      | Descripcion                                   |
| --------------- | ------------ | --------------------------------------------- |
| `/setwelcome`   | config.write | Define el mensaje de bienvenida (con variables).|
| `/welcome`      | —            | Muestra el mensaje de bienvenida actual.      |
| `/resetwelcome` | config.write | Desactiva la bienvenida.                      |
| `/setrules`     | config.write | Define las reglas del chat.                   |
| `/rules`        | —            | Muestra las reglas.                           |
| `/setgoodbye`   | config.write | Define el mensaje de despedida.               |

Variables soportadas en plantillas: `{first_name}`, `{username}`, `{chat_title}`. La
bienvenida se envia automaticamente cuando entra un nuevo miembro (si esta configurada).

## Reputacion y niveles (Fase 2)

| Comando  | Permiso | Descripcion                                            |
| -------- | ------- | ------------------------------------------------------ |
| `/rep`   | —       | `/rep <id>` da +1 a otro usuario; `/rep` muestra la tuya.|
| `/top`   | —       | Ranking de reputacion del chat (top 10).               |
| `/level` | —       | Muestra tu XP y nivel (alias `/rank`).                 |

Cada mensaje de texto otorga XP (max. una vez por minuto y usuario, antifarming). El nivel se
calcula con la curva `10*n^2`; al subir de nivel el bot lo anuncia. No se puede dar reputacion a
uno mismo y hay cooldown de 1 hora por par emisor/receptor.

## Invitaciones (Fase 2)

| Comando     | Permiso | Descripcion                                  |
| ----------- | ------- | -------------------------------------------- |
| `/invites`  | —       | Numero de miembros que has invitado.         |
| `/inviters` | —       | Ranking de invitadores del chat (top 10).    |

Cuando un miembro anade nuevos usuarios al grupo, se acredita el numero de invitados (excluyendo
auto-altas) en `InviteStat` y se audita el evento.

## Analitica (Fase 2)

| Comando     | Permiso | Descripcion                                   |
| ----------- | ------- | --------------------------------------------- |
| `/stats`    | —       | Mensajes totales, de hoy y de los ultimos 7 dias.|
| `/activity` | —       | Detalle de actividad por dia (ultimos 7).     |

Cada mensaje incrementa el contador diario `ActivityDaily` (bucket por dia UTC). Los resumenes
se calculan con `sumRecentMessages` sobre los dias almacenados.

## Quizzes (Fase 2)

| Comando | Permiso | Descripcion                                                   |
| ------- | ------- | ------------------------------------------------------------- |
| `/quiz` | —       | `/quiz Pregunta \| Correcta \| Incorrecta [\| ...]` (1 correcta).|

A diferencia de `/poll`, el quiz tiene respuesta correcta. Las opciones se barajan de forma
determinista (`orderQuizOptions`); la sesion se persiste en `GameSession` (kind `quiz`). El
**primer acierto** (callback `quiz:<id>:<i>`) cierra la sesion y suma 1 punto en `GameScore`.

## Encuestas (Fase 2)

| Comando | Permiso | Descripcion                                              |
| ------- | ------- | -------------------------------------------------------- |
| `/poll` | —       | `/poll Pregunta \| Opcion 1 \| Opcion 2 [\| ...]` (2-10). |

La encuesta se publica con botones inline; cada voto (callback `poll:<id>:<i>`) se guarda en
`PollVote` (un voto por usuario, modificable) y el bot responde con el recuento y porcentajes
verificables. Los votos fuera de rango se descartan.

## Sorteos (Fase 2)

| Comando     | Permiso      | Descripcion                                  |
| ----------- | ------------ | -------------------------------------------- |
| `/giveaway` | config.write | `/giveaway <premio>` crea un sorteo con boton.|
| `/gdraw`    | config.write | `/gdraw <id>` sortea un ganador verificable. |

Participar es un callback `giveaway:<id>` (un registro por usuario). El ganador se elige de forma
**verificable**: se genera una semilla aleatoria, se ordenan los participantes y el indice es
`FNV1a(semilla) % n`; la semilla se publica para que cualquiera reproduzca el resultado.

## Publicaciones programadas (Fase 2)

| Comando       | Permiso      | Descripcion                                   |
| ------------- | ------------ | --------------------------------------------- |
| `/schedule`   | config.write | `/schedule <minutos> <mensaje>` programa un envio.|
| `/schedules`  | —            | Lista las publicaciones pendientes.           |
| `/unschedule` | config.write | `/unschedule <id>` cancela una pendiente.     |

El mensaje se guarda en `ScheduledPost` con su `runAt`. El worker ejecuta el job repetible
`post.publish.due` cada 60s: busca las publicaciones vencidas, las envia por el Telegram Gateway
y las marca como `sent` (o `failed`).

## Soporte y tickets (Fase 3)

| Comando         | Permiso          | Descripcion                                       |
| --------------- | ---------------- | ------------------------------------------------- |
| `/ticket`       | —                | `/ticket [prioridad] <asunto>` crea un ticket.    |
| `/tickets`      | —                | Lista los tickets abiertos del chat.              |
| `/ticketclose`  | moderation.write | `/ticketclose <id>` cierra un ticket.             |
| `/ticketreopen` | moderation.write | `/ticketreopen <id>` reabre un ticket.            |
| `/ticketassign` | moderation.write | `/ticketassign <id> <user_id>` asigna un agente.  |

Prioridades: `low, normal, high, urgent`. Cada ticket lleva numero correlativo por tenant,
estado (open/assigned/closed), reportante y agente; todas las transiciones se auditan. Modelos
`Ticket` + `TicketMessage`.

## Recordatorios y tareas (Fase 3)

| Comando      | Permiso | Descripcion                                       |
| ------------ | ------- | ------------------------------------------------- |
| `/remind`    | —       | `/remind <minutos> <texto>` programa un recordatorio.|
| `/reminders` | —       | Lista tus recordatorios pendientes.               |
| `/unremind`  | —       | `/unremind <id>` cancela un recordatorio.         |
| `/task`      | —       | `/task <titulo>` crea una tarea.                  |
| `/tasks`     | —       | Lista tus tareas pendientes.                      |
| `/taskdone`  | —       | `/taskdone <id>` marca una tarea como hecha.      |

Los recordatorios (`Reminder`) los dispara el worker con el job repetible `reminder.fire.due`
cada 60s. Las tareas (`Task`) llevan numero correlativo por chat. Ambos en `ProductivityRepository`.

## Automatizaciones RSS (Fase 3)

| Comando         | Permiso      | Descripcion                                |
| --------------- | ------------ | ------------------------------------------ |
| `/rss add`      | config.write | `/rss add <url>` suscribe un feed al chat. |
| `/rss list`     | —            | Lista los feeds del chat.                  |
| `/rss remove`   | config.write | `/rss remove <id>` elimina un feed.        |

El feed se guarda en `Feed`. El worker ejecuta el job repetible `rss.poll.due`: descarga cada
feed activo (parser RSS/Atom propio con `parseFeedItems`), entrega los items nuevos respecto al
cursor (`selectNewItems`, mas antiguos primero, max 5/feed) y avanza el cursor. Cada feed se
procesa de forma aislada (un feed roto no bloquea los demas).

## Webhooks salientes (Fase 3)

| Comando          | Permiso      | Descripcion                                   |
| ---------------- | ------------ | --------------------------------------------- |
| `/webhook add`   | config.write | `/webhook add <url>` registra un endpoint.    |
| `/webhook list`  | —            | Lista los webhooks del chat.                  |
| `/webhook remove`| config.write | `/webhook remove <id>` elimina un webhook.    |

Cada webhook recibe un **secreto de firma** propio. Al registrarse se encola un ping
(`webhook.registered`). El worker (`webhook.deliver.due`) entrega las entregas pendientes haciendo
POST con cabecera `x-superbot-signature` = HMAC-SHA256(body, secret), marcando delivered/failed;
cada entrega esta aislada. Modelos `Webhook` + `WebhookDelivery`.

## Archivos (Fase 4)

| Comando      | Permiso | Descripcion                                  |
| ------------ | ------- | -------------------------------------------- |
| `/files`     | —       | Lista los archivos recientes del chat.       |
| `/filequota` | —       | Muestra el uso de almacenamiento del chat.   |

Cuando un miembro envia un adjunto (documento/foto/video/audio/voz/animacion), el bot lo valida
estaticamente (`validateAttachment`: tamaño max, extensiones peligrosas bloqueadas como exe/js/bat,
allowlist de MIME opcional) y lo registra en `FileAsset` deduplicando por `file_unique_id`. Los
rechazos y registros/deduplicaciones se auditan. La descarga real y el antivirus completo son tareas
del worker (adaptador de almacenamiento S3/local pendiente de credenciales).

## Juegos — Trivia (Fase 4)

| Comando   | Permiso | Descripcion                                       |
| --------- | ------- | ------------------------------------------------- |
| `/trivia` | —       | Lanza una pregunta de trivia con opciones inline. |

Banco de preguntas propio (no copiado de otros bots). Se responde por callback `trivia:<id>:<i>`;
**solo la primera respuesta correcta** cierra la sesion (cierre atomico `closeWithWinner`) y suma 1
punto en `GameScore`. Las sesiones (`GameSession`) se persisten, asi que **sobreviven a reinicios**.

## MiniApp - Juegos arcade

| Comando   | Permiso | Descripcion                         |
| --------- | ------- | ----------------------------------- |
| `/jugar`  | â€”       | Abre la MiniApp de juegos arcade.   |
| `/juegos` | â€”       | Alias de `/jugar`.                  |
| `/games`  | â€”       | Alias de `/jugar`.                  |

En privado, Telegram recibe un boton `web_app` directo a `/games`. En grupos, Telegram no acepta
`web_app` en botones normales, asi que el bot envia enlaces `t.me/<bot>/<miniapp>?startapp=...`
por juego; esas partidas quedan asociadas al grupo para la clasificacion.

## Casino

| Comando        | Permiso | Descripcion                                              |
| -------------- | ------- | -------------------------------------------------------- |
| `/casino`      | â€”       | Ayuda del casino y boton a la mesa MiniApp.              |
| `/cartera`     | â€”       | Muestra saldo de fichas virtuales.                       |
| `/bono`        | â€”       | Reclama el bono diario.                                  |
| `/dado`        | â€”       | `/dado <apuesta> [bajo\|alto] [objetivo]`.               |
| `/tragaperras` | â€”       | `/tragaperras <apuesta>` con el slot nativo de Telegram. |
| `/mm`          | â€”       | `/mm <apuesta> <bajo\|siete\|alto>`.                    |
| `/diana`       | â€”       | `/diana <apuesta> <fuera\|aro\|diana>`.                 |
| `/duelo`       | â€”       | `/duelo <apuesta>` crea un reto PvP.                     |

## Inteligencia artificial (Fase 5)

| Comando      | Permiso | Descripcion                                      |
| ------------ | ------- | ------------------------------------------------ |
| `/ai`        | —       | `/ai <pregunta>` chatea con la IA (con memoria). |
| `/summarize` | —       | `/summarize <texto>` resume un texto.            |
| `/translate` | —       | `/translate <idioma> <texto>` traduce.           |
| `/aiforget`  | —       | Borra la memoria de conversacion de la IA.       |

Capa multi-proveedor (`@superbot/module-ai`): `AiRouter` prueba proveedores en orden con
**fallback** y **circuit breaker**; el `FakeAiProvider` mantiene la capa funcional y testeable sin
credenciales (los adaptadores reales se enchufan delante cuando hay claves). Seguridad:
`sanitizeAiInput` limpia caracteres de control y **bloquea inyeccion de prompt** (auditado), prompt
de sistema con guardas, **memoria por usuario/chat** (`AiConversation`/`AiMessage`, desactivable con
`/aiforget`), **presupuesto de tokens por chat** (`AiUsage`) y degradacion suave si el proveedor
falla. La IA nunca bloquea moderacion ni pagos.

## Pagos — Telegram Stars (Fase 7)

| Comando       | Permiso      | Descripcion                                   |
| ------------- | ------------ | --------------------------------------------- |
| `/products`   | —            | Lista los productos disponibles.              |
| `/buy`        | —            | `/buy <id>` genera y envia una factura Stars. |
| `/addproduct` | config.write | `/addproduct <id> <precio_stars> <titulo>`.   |

Flujo: `/buy` crea un `Invoice` y envia `sendInvoice` (moneda `XTR`). Telegram emite un
`pre_checkout_query` que el bot responde con `answerPreCheckoutQuery` (aprueba solo si el producto
existe y el importe coincide). El `successful_payment` se registra en `Payment` de forma
**idempotente por `telegram_payment_charge_id`** (ledger sin doble conteo); los duplicados se
auditan como `payment.duplicate`. **No se ejecutan pagos reales**: el flujo se valida con fixtures
de update; los Stars reales requieren un bot publicado.
## D1 - Control Center Pro MVP

| Comando             | Permiso      | Descripcion                                      |
| ------------------- | ------------ | ------------------------------------------------ |
| `/logs status`      | —            | Muestra el canal de logs D1 configurado.         |
| `/logs set here`    | config.write | Usa el chat actual como canal de logs D1.        |
| `/logs set <id>`    | config.write | Envia logs D1 a otro chat/canal.                 |
| `/logs off`         | config.write | Desactiva logs D1 para el grupo.                 |
| `/logs events`      | —            | Lista los eventos D1 recientes.                  |
| `/quarantine on`    | config.write | Activa cola de revision para mensajes dudosos.   |
| `/quarantine off`   | config.write | Desactiva cuarentena.                            |
| `/quarantine list`  | config.write | Lista items pendientes.                          |
| `/qapprove <id>`    | config.write | Aprueba un item y republica el texto capturado.  |
| `/qreject <id>`     | config.write | Rechaza un item.                                 |
| `/appeal <caso> <texto>` | —       | Abre una apelacion por DM o grupo.               |
| `/appeals`          | config.write | Lista apelaciones abiertas.                      |
| `/appeal_accept <id>` | config.write | Acepta una apelacion.                          |
| `/appeal_deny <id>` | config.write | Deniega una apelacion.                           |
| `/diagnose`         | config.write | Doctor del grupo con score y recomendaciones.    |
| `/auto list`        | —            | Lista automatizaciones del grupo.                |
| `/auto add contains <texto> -> reply <respuesta>` | config.write | Responde al detectar texto. |
| `/auto add contains <texto> -> delete` | config.write | Borra mensajes que coincidan.      |
| `/auto add contains <texto> -> quarantine` | config.write | Envia mensajes a cuarentena. |
| `/auto remove <id>` | config.write | Desactiva una automatizacion.                    |
| `/mission add messages <n> <titulo>` | config.write | Crea una mision de actividad. |
| `/missions`         | —            | Lista misiones o tu progreso.                    |
| `/mission close <id>` | config.write | Cierra una mision.                             |
| `/mybadges`         | —            | Lista tus badges ganados.                        |

Modelos nuevos: `D1LogConfig`, `D1Event`, `QuarantineConfig`, `QuarantineItem`,
`D1Appeal`, `AutomationRule`, `Mission`, `MissionProgress` y `UserBadge`. La
cuarentena detecta de forma conservadora enlaces sospechosos, forwards con enlaces y,
en modo estricto, enlaces/adjuntos. Las automatizaciones MVP soportan trigger
`contains` y acciones `reply`, `delete`, `quarantine` y `log`.

## MiniApp /config - Red de grupos

La gestion multi-grupo vive dentro de `/config`, no como comandos nuevos. Abre
`/config` desde un grupo y entra en `Red de grupos`.

Capacidades del MVP:

- Crear una red privada de grupos propietarios.
- Copiar el ID de red y unir otros grupos desde su propia MiniApp `/config`.
- Ver grupos conectados y su estado de logs/requisitos.
- Centralizar logs D1 para todos los grupos de la red.
- Marcar roles por grupo (`Staff`, `Logs`, `Soporte`, `Avisos`, `Archivo`).
- Configurar rutas globales para `reportes`, `tickets`, `logs D1`,
  `cuarentena`, `apelaciones`, `moderacion`, `raid` y `spam`.
- Configurar overrides del grupo actual para enviar un evento a un destino
  distinto del global.
- Configurar bienvenida y despedida en modo `Por grupo` o `Global`.
- Configurar reglas en modo `Por grupo` o `Global`.
- Activar `Mismos` miembros: cada grupo exige pertenecer a los demas grupos de
  la red. El bot debe ser administrador en todos para comprobar miembros.

Persistencia: reutiliza `Federation`/`FederationChat` para la pertenencia de la
red, `OwnerNetworkConfig` para la politica global, `OwnerNetworkGroupRole` para
roles y `OwnerNetworkRoute` para rutas. Si hay una ruta de red configurada, el
bot la usa antes del fallback antiguo de `/logs`; si no existe, mantiene el
comportamiento previo (`D1LogConfig`, `WelcomeConfig`, `GroupMembershipGate`).
