## Prioridad alta

### 1. Centro de mando owner

Pantalla inicial para el owner con el estado real de toda la plataforma:

- Grupos activos e inactivos.
- Bots hijos sanos, caidos o sin updates recientes.
- Reportes, tickets, apelaciones y cuarentenas pendientes.
- Alertas criticas: permisos perdidos, rutas rotas, admin baneado, errores de API.
- Resumen de crecimiento, actividad, juegos y riesgo.

Objetivo: que al abrir la MiniApp el owner sepa que requiere atencion sin entrar en
20 pantallas.

### 2. Inbox unico

Unificar todo lo accionable en una sola cola:

- Reportes.
- Tickets.
- Apelaciones.
- Mensajes en cuarentena.
- Alertas de risk.
- Errores de bots hijos.
- Rutas rotas.
- Permisos perdidos.

Cada item deberia tener acciones directas: ver usuario, ver grupo, resolver,
banear, aprobar, rechazar, mover a staff, silenciar alerta o crear caso.

### 3. Perfil global de usuario

Ficha global para cada usuario visto por Modryva:

- Grupos donde esta.
- Bots hijos con los que interactuo.
- Historial de warns, bans, mutes, reports y apelaciones.
- Juegos/casino virtual, badges, reputacion y actividad.
- Trust score interno.
- Notas privadas de staff.
- Intentos bloqueados por ban global o rate limit.

Acciones desde el perfil:

- Ban global.
- Watchlist.
- Trusted user.
- Mutear/banear en red.
- Quitar de varios grupos.
- Resetear historial.
- Crear nota de staff.

### 4. Score de salud de grupo

Nota 0-100 para cada grupo:

- Permisos del bot.
- Logs configurados.
- Staff/rutas configuradas.
- Captcha/antiraid/antiflood activos.
- Reports pendientes.
- Actividad y crecimiento.
- Usuarios nuevos sospechosos.
- Backups recientes.
- Riesgo de configuracion.

Debe incluir recomendaciones concretas:

- "Activa captcha porque entraron muchos usuarios nuevos".
- "Falta configurar grupo staff".
- "El bot no puede borrar mensajes".
- "Hay demasiadas apelaciones pendientes".

### 5. Plantillas con simulacion

Plantillas listas para aplicar:

- Comunidad chill.
- Comunidad estricta.
- Staff interno.
- Gaming/casino.
- Canal con comentarios.
- Grupo premium.
- Red privada de grupos.
- Lanzamiento/evento.

Antes de aplicar, mostrar simulacion:

- Que modulos se activan.
- Que permisos necesita.
- Donde iran logs/reportes/tickets.
- Que cambia respecto a la configuracion actual.
- Snapshot automatico para rollback.

### 6. Buscador global

Buscador en MiniApp para encontrar:

- Usuarios por ID, username o nombre.
- Grupos.
- Bots hijos.
- Tickets.
- Reports.
- Apelaciones.
- Logs.
- Casos de moderacion.
- Comandos/configuraciones.

Idealmente con command palette tipo "activar captcha", "ver usuario", "crear
sorteo" o "mandar mensaje como bot hijo".

### 7. Timeline accionable

Timeline por grupo, usuario, bot hijo y red:

- Entradas/salidas.
- Config changes.
- Mensajes borrados.
- Reports/tickets/apelaciones.
- Juegos ganados.
- Bans/warns/mutes.
- Cambios de permisos.
- Errores de Telegram.

Cada evento deberia permitir acciones: revertir, abrir perfil, abrir caso,
banear, copiar evidencia o ir a la configuracion relacionada.

### 8. Centro de bots hijos pro

Mejorar el panel creator:

- Ver todos los bots hijos creados por Modryva.
- Estado de cada bot: activo, suspendido, error, sin updates, sin token valido.
- Grupos vistos por cada bot con nombre real.
- Acceso total del owner a cualquier bot hijo.
- Escribir como cualquier bot hijo en cualquier grupo permitido.
- Actualizar menu, comandos, MiniApp URL y branding por lote.
- Clonar bot hijo.
- Suspender/reactivar.
- Ver logs y errores de cada hijo.

### 9. Permisos visuales y rollback

Pantalla para entender quien puede hacer que:

- Owner.
- Staff de plataforma.
- Staff de red.
- Admin de grupo.
- Auditor solo lectura.
- Soporte tickets.
- Casino manager.

Cada cambio importante deberia guardar historial:

- Quien cambio algo.
- Que cambio.
- Antes/despues.
- Boton para revertir.

