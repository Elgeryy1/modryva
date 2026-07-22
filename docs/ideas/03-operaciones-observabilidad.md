## Operaciones y observabilidad

### 20. Bot doctor automatico

No solo `/diagnose`. Revisiones periodicas:

- Permisos Telegram.
- Rutas rotas.
- Logs apagados.
- Bots hijos sin updates.
- Web/API/worker con errores.
- Grupos sin plantilla.

Crear alertas accionables, no solo logs.

### 21. Autofix

Botones de reparacion:

- Activar logs.
- Aplicar plantilla segura.
- Reparar rutas.
- Reconfigurar menu del bot hijo.
- Reintentar webhook/menu/MiniApp URL.
- Crear snapshot antes de tocar nada.

### 22. Test de rutas

Boton para probar:

- Logs.
- Reportes.
- Tickets.
- Apelaciones.
- Alertas criticas.
- Owner DM.

Debe mandar mensajes fake y confirmar si llegan.

### 23. Fallback de rutas

Si una ruta falla:

- Staff no existe.
- Bot no puede escribir.
- Grupo fue eliminado.
- Bot no es admin.

Entonces mandar al owner y marcar la ruta como rota.

### 24. Centro de errores

Agrupar errores por:

- Servicio: bot, api, worker, web.
- Metodo Telegram.
- Bot hijo.
- Grupo.
- Frecuencia.
- Ultima vez.

Con accion: ver logs, silenciar, crear issue, reintentar.

### 25. Replay de update

Desde logs:

- Ver update normalizado.
- Reprocesar en modo simulacion.
- Comparar respuesta esperada.
- Reproducir bugs sin esperar a Telegram.

### 26. Feature flags y canary

Activar funciones nuevas:

- Solo owner.
- Solo un grupo.
- Solo un bot hijo.
- Solo una red.
- Por porcentaje.

Un bot hijo puede ser canary antes del principal.

