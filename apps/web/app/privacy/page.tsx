import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacidad · Modryva",
  description: "Política de privacidad de Modryva",
};

export default function PrivacyPage() {
  return (
    <main className="legal">
      <h1>Política de privacidad</h1>
      <p className="updated">Última actualización: 4 de julio de 2026</p>

      <p className="lead">
        Modryva es un servicio para administrar grupos de Telegram y crear tus
        propios bots de marca gestionados. Esta política explica qué datos
        tratamos y para qué. Al usar Modryva aceptas lo aquí descrito.
      </p>

      <h2>Qué datos tratamos</h2>
      <ul>
        <li>
          <strong>Identificadores de Telegram:</strong> IDs de usuario y de
          grupo, y el nombre o @usuario que Telegram nos comparte, para
          identificar quién administra qué grupo.
        </li>
        <li>
          <strong>Configuración de tus grupos:</strong> bienvenida, reglas,
          antiflood, captcha, locks, notas y filtros que tú creas.
        </li>
        <li>
          <strong>Registros de auditoría:</strong> las acciones de
          administración (baneos, cambios de configuración) para que puedas
          revisarlas.
        </li>
        <li>
          <strong>Bots de marca:</strong> si creas uno, guardamos su token
          cifrado (AES-256-GCM) para poder operarlo en tu nombre.
        </li>
        <li>
          <strong>Pagos con Telegram Stars:</strong> guardamos el identificador
          de la transacción para asignarte tus beneficios. Telegram procesa el
          pago; nosotros no vemos ni almacenamos datos de tarjeta.
        </li>
      </ul>

      <h2>Mensajes</h2>
      <p>
        Para moderar (antispam, captcha, filtros, blocklists) Modryva procesa
        los mensajes de los grupos donde está. No almacenamos el contenido de
        los mensajes, salvo el texto que tú configuras a propósito (bienvenida,
        reglas, notas, respuestas automáticas).
      </p>

      <h2>Para qué usamos los datos</h2>
      <p>
        Únicamente para prestar el servicio: moderación, configuración, juegos y
        pagos. No vendemos ni cedemos tus datos a terceros con fines
        publicitarios.
      </p>

      <h2>Conservación y borrado</h2>
      <p>
        Puedes pedir el borrado de los datos de tu grupo o de tu bot escribiendo
        a <a href="https://t.me/ModryvaBot">@ModryvaBot</a>. Al expulsar a
        Modryva de un grupo, o al caducar/eliminar un bot de marca, detenemos su
        tratamiento.
      </p>

      <h2>Seguridad</h2>
      <p>
        Los tokens de los bots de marca se cifran en reposo. El acceso a cada
        grupo y a cada Mini App se verifica criptográficamente (la firma de
        Telegram). No exponemos tokens en respuestas ni en registros.
      </p>

      <h2>Menores</h2>
      <p>
        Modryva no está dirigido a personas por debajo de la edad mínima exigida
        por Telegram.
      </p>

      <h2>Cambios y contacto</h2>
      <p>
        Publicaremos aquí cualquier cambio en esta política. Para cualquier
        cuestión, escríbenos a <a href="https://t.me/ModryvaBot">@ModryvaBot</a>{" "}
        en Telegram.
      </p>

      <p>
        <a href="/terms">Términos de servicio</a> · <a href="/">Inicio</a>
      </p>
    </main>
  );
}
