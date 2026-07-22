# Política de seguridad

## Reportar una vulnerabilidad

**No abras un issue público** para reportar una vulnerabilidad de seguridad.

Usa el reporte privado de GitHub:

1. Ve a la pestaña **Security** del repositorio.
2. **Report a vulnerability** (Privately report a vulnerability).
3. Describe el problema, el impacto y, si puedes, un caso de reproducción mínimo.

Intentaremos acusar recibo en un plazo razonable y coordinar una divulgación
responsable una vez haya un arreglo disponible.

## Alcance

Interesan especialmente:

- Fugas o escalada entre tenants (aislamiento de datos por chat/bot).
- Bypass de la verificación guardian o de los controles de acceso/roles.
- Inyección (SQL, comandos, prompts de IA) y XSS en la Mini App.
- Exposición de secretos, tokens o datos de usuario.
- Fallos de integridad en la economía de fichas / pagos.

## Buenas prácticas al desplegar

- Nunca commitees tu `.env` real; parte de `.env.example`.
- Rota `TELEGRAM_BOT_TOKEN`, `SESSION_SECRET` y demás secretos si sospechas exposición.
- Mantén Postgres y Redis fuera del acceso público de red.
