import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Términos · Modryva",
  description: "Términos de servicio de Modryva",
};

export default function TermsPage() {
  return (
    <main className="legal">
      <h1>Términos de servicio</h1>
      <p className="updated">Última actualización: 4 de julio de 2026</p>

      <p className="lead">
        Estos términos regulan el uso de Modryva, un servicio para administrar
        grupos de Telegram y crear bots de marca gestionados. Al usar Modryva
        aceptas estos términos.
      </p>

      <h2>El servicio</h2>
      <p>
        Modryva ofrece moderación, bienvenidas, captcha, antispam, juegos y la
        posibilidad de crear tus propios bots de marca gestionados por la misma
        plataforma.
      </p>

      <h2>Uso aceptable</h2>
      <ul>
        <li>No uses Modryva para spam, acoso, fraude ni contenido ilegal.</li>
        <li>
          Cumple en todo momento los{" "}
          <a href="https://telegram.org/tos">
            Términos de Servicio de Telegram
          </a>{" "}
          y las normas de BotFather.
        </li>
        <li>
          No intentes eludir los límites del servicio ni abusar de sus
          endpoints.
        </li>
      </ul>

      <h2>Bots de marca</h2>
      <p>
        Eres responsable del bot que creas y de cómo se usa en tus grupos, así
        como de cumplir las reglas de Telegram. Un acceso caducado desactiva el
        bot; puedes reactivarlo si renuevas.
      </p>

      <h2>Fichas y juegos</h2>
      <p>
        Las fichas del casino son virtuales y solo sirven para entretenimiento.{" "}
        <strong>
          No tienen valor monetario, no son canjeables por dinero y no se pueden
          retirar.
        </strong>
      </p>

      <h2>Pagos con Telegram Stars</h2>
      <p>
        Las compras se procesan a través de Telegram Stars. Los reembolsos se
        rigen por las políticas de Telegram. Los beneficios adquiridos (como los
        accesos para crear bots) se asignan a tu cuenta de Telegram.
      </p>

      <h2>Disponibilidad y responsabilidad</h2>
      <p>
        El servicio se ofrece «tal cual», sin garantías de disponibilidad
        ininterrumpida. Podemos suspender bots o funciones por caducidad del
        acceso, incumplimiento de estos términos o razones de seguridad. En la
        medida que permita la ley, Modryva no será responsable de daños
        indirectos derivados del uso del servicio.
      </p>

      <h2>Cambios y contacto</h2>
      <p>
        Podemos actualizar estos términos; publicaremos aquí la versión vigente.
        Para cualquier cuestión, escríbenos a{" "}
        <a href="https://t.me/ModryvaBot">@ModryvaBot</a> en Telegram.
      </p>

      <p>
        <a href="/privacy">Política de privacidad</a> · <a href="/">Inicio</a>
      </p>
    </main>
  );
}
