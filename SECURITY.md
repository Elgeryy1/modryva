<div align="center">

# 🔐 Política de seguridad

**Nos tomamos la seguridad muy en serio.** Gracias por ayudarnos a mantener Modryva —y a sus comunidades— a salvo.

</div>

---

## 📦 Versiones con soporte

Modryva está en desarrollo activo. El soporte de seguridad se da sobre la rama principal:

| Versión | Soporte |
|---|:---:|
| `main` (última) | ✅ |
| Versiones anteriores | ❌ |

Recomendamos desplegar siempre desde la última `main`.

---

## 🚨 Cómo reportar una vulnerabilidad

> **Por favor, NO abras un issue público** para una vulnerabilidad de seguridad.
> La divulgación pública antes de que exista un arreglo pone en riesgo a todas las comunidades que usan Modryva.

Usa el **reporte privado de GitHub**:

1. Ve a la pestaña **[Security](https://github.com/Elgeryy1/modryva/security)** del repositorio.
2. Pulsa **Report a vulnerability** (*Privately report a vulnerability*).
3. Cuéntanos:
   - 🎯 el **impacto** y quién se ve afectado,
   - 🔁 un **caso de reproducción** mínimo (si puedes),
   - 🧩 la versión/commit y el entorno.

También puedes abrir directamente un [aviso privado aquí](https://github.com/Elgeryy1/modryva/security/advisories/new).

---

## ⏱️ Qué puedes esperar

| Etapa | Compromiso |
|---|---|
| 🤝 **Acuse de recibo** | En cuanto podamos, dentro de un plazo razonable |
| 🔎 **Evaluación** | Confirmamos, reproducimos y valoramos la severidad |
| 🛠️ **Arreglo** | Trabajamos un parche y coordinamos la divulgación contigo |
| 📣 **Divulgación** | Publicamos el aviso una vez haya arreglo disponible, con crédito si lo deseas |

---

## 🎯 Alcance

**Nos interesa especialmente:**

| ✅ Dentro de alcance |
|---|
| Fugas o escalada **entre tenants** (aislamiento de datos por chat/bot) |
| **Bypass del Guardian** o de los controles de acceso/roles |
| **Inyección** (SQL, comandos, prompts de IA) y **XSS** en la Mini App |
| Exposición de **secretos, tokens o datos** de usuario |
| Fallos de **integridad** en la economía de fichas / pagos |
| Autenticación y firma de sesiones (Telegram init-data, webhooks) |

**Normalmente fuera de alcance:**

| ❌ Fuera de alcance |
|---|
| Ataques que requieren acceso físico o de administrador ya comprometido |
| Ingeniería social a mantenedores o usuarios |
| DoS por fuerza bruta de volumen sin un fallo lógico subyacente |
| Problemas en dependencias de terceros ya reportados *upstream* |

---

## 🛡️ Puerto seguro (safe harbor)

Si investigas de buena fe, respetas la privacidad de los usuarios, **no destruyes datos**
ni interrumpes el servicio, y nos das un tiempo razonable para arreglar antes de divulgar,
consideraremos tu investigación **autorizada** y no emprenderemos acciones en tu contra.

---

## 🔧 Buenas prácticas al desplegar

- 🚫 Nunca commitees tu `.env` real; parte de `.env.example`.
- 🔑 Rota `TELEGRAM_BOT_TOKEN`, `SESSION_SECRET` y demás secretos si sospechas exposición.
- 🧱 Mantén **Postgres y Redis fuera** del acceso público de red.
- 🔒 Cifra los tokens de los bots hijos (Modryva ya lo hace: `MANAGED_BOT_TOKEN_KEY`).
- 🧾 Revisa periódicamente los logs de auditoría.

---

<div align="center">

Gracias por hacer de Modryva un lugar más seguro. 💙

</div>
