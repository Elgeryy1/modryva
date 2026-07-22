## Seguridad y anti-abuso

### 10. Trust score por usuario

Score interno basado en:

- Antiguedad.
- Actividad normal.
- Reports validos.
- Warns/bans/mutes.
- Entradas sospechosas.
- Links enviados.
- Intentos bloqueados.
- Relacion con otros usuarios sospechosos.
- Abuso de juegos/casino virtual.

Debe alimentar captcha adaptativo, cuarentena, watchlist y alertas.

### 11. Watchlist

Usuarios observados sin estar baneados:

- Si entran a un grupo, alerta.
- Si hablan, alerta.
- Si juegan o usan MiniApp, alerta.
- Si cambian username/nombre, registrar.

Util para gente problematica que aun no quieres banear.

### 12. Trusted users

Usuarios confiables que saltan reglas suaves:

- Captcha.
- Cuarentena.
- Filtros suaves.
- Algunos limits.

Se puede ganar por antiguedad o asignar manualmente.

### 13. Shadow ban suave

Modo silencioso para abusadores:

- El bot deja de responderles.
- No cuentan en rankings/juegos.
- No disparan automatizaciones visibles.
- Se registra todo para staff.

Menos dramatico que un ban publico.

### 14. Modo nuevo usuario

Restricciones durante los primeros minutos/horas:

- Sin links.
- Sin multimedia.
- Sin menciones masivas.
- Sin casino/juegos.
- Mensajes limitados.
- Cuarentena opcional.

Configurable por grupo o plantilla.

### 15. Anti-scam e impersonation

Detectar:

- Soporte falso.
- Regalos falsos.
- Links raros.
- Acortadores.
- Crypto scams.
- Usuarios copiando nombre/foto de admins.
- Usuarios haciendose pasar por el bot.

Acciones: borrar, cuarentena, aviso staff, ban temporal, ban global si reincide.

### 16. Reputacion de dominios

Cada dominio obtiene reputacion interna:

- Visto en spam.
- Borrado por staff.
- Reportado.
- Usado en raids.
- Permitido por admins.

Los dominios malos suben riesgo de usuario y pueden activar cuarentena.

### 17. Anti-abuso de reports

Detectar usuarios que reportan falsamente o en masa:

- Limitar reports.
- Bajar trust score.
- Avisar staff.
- Requerir motivo obligatorio.

### 18. Escalado inteligente de reportes

Reglas:

- Reporte normal -> staff.
- Reporte grave -> owner.
- Reporte contra staff -> owner directo.
- Muchos reportes en poco tiempo -> incidente.
- Reporte de usuario watchlist -> prioridad alta.

### 19. Raids entre grupos

Si la misma oleada aparece en varios grupos de una red:

- Activar defensa global.
- Subir captcha.
- Bloquear links.
- Avisar owner.
- Crear incidente.

