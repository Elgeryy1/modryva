# `telegram-web-app.js` — por qué está aquí y no se carga del CDN

Copia literal del SDK de Mini Apps de Telegram.

- Origen: `https://telegram.org/js/telegram-web-app.js`
- Descargado: **2 de agosto de 2026**
- Tamaño: 116.510 bytes
- SHA-256: `3549138a7934039fe7dfd1291a4ee739bd2b705a614308053a8b08a87d85c451`

## El motivo

Se cargaba desde `telegram.org` con `strategy="beforeInteractive"`, que es
**bloqueante**: Next no hidrata hasta tenerlo. La página de verificación no
renderiza nada en servidor, así que si ese fichero no llegaba —bloqueo de ISP,
DNS, un mal día del CDN— el usuario se quedaba mirando un esqueleto de carga
**indefinidamente**: sin timeout, sin mensaje y sin reintento. Y como la página
nunca llegaba a ejecutarse, tampoco había ni una petición en el servidor: esas
sesiones quedaban en `progressStep 0`, indistinguibles de alguien que pasó del
tema. Medido el 2 ago 2026: **15 de 52 sesiones (29%) se quedaban en el paso 0**.

Servirlo desde nuestro propio origen convierte una dependencia externa que
puede colgar la aplicación entera en una que ya está garantizada: si el
navegador ha podido descargar el HTML, puede descargar esto.

## Qué hay que vigilar

Está **congelado**. Telegram publica versiones nuevas del SDK y esta copia no
se entera. Lo que usamos (`ready`, `expand`, `initData`, `MainButton`,
`BackButton`, `HapticFeedback`, `setHeaderColor`, `setBackgroundColor`) lleva
estable desde las primeras versiones, así que el riesgo es bajo — pero si algún
día hace falta una API nueva de Mini Apps, **lo primero es actualizar este
fichero** y anotar aquí la fecha y el hash nuevos.
