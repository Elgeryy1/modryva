"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useState } from "react";
import {
  AppHeader,
  Banner,
  Button,
  Field,
  Group,
  GroupNote,
  Row,
  Screen,
  Section,
  SkeletonList,
  Toggle,
  useBackButton,
} from "../../../components/ui";
import {
  type EconomyRulesInput,
  type GroupCurrencyInput,
  getEconomyRules,
  getGroupCurrency,
  getShopRules,
  type ShopCatalogItem,
  type ShopRulesInput,
  updateEconomyRules,
  updateGroupCurrency,
  updateShopRules,
} from "../../../lib/api-gamification";
import { haptic, ready } from "../../../lib/telegram";

/** Espeja `defaultGroupCurrencySettings` del bot, para que la pantalla enseñe
 * lo mismo que aplicaria el chat mientras carga. */
const DEFAULT_CURRENCY: GroupCurrencyInput = {
  enabled: false,
  nombre: "monedas",
  simbolo: "🪙",
  porMensaje: 1,
  cupoDiario: 200,
  minCaracteres: 4,
  cooldownSegundos: 60,
  premioPartida: 25,
  monedasPorFicha: 0,
  comisionVentaPct: 20,
};

/** Espeja los defaults del bot para robo y purga. */
const DEFAULT_RULES: EconomyRulesInput = {
  steal: {
    enabled: false,
    baseChancePct: 35,
    maxChancePct: 75,
    chancePerLevelPct: 2,
    lootPct: 20,
    lootMax: 500,
    finePct: 10,
    fineMax: 250,
    cooldownSeconds: 1800,
    victimShieldSeconds: 3600,
    minVictimBalance: 50,
  },
  purge: {
    enabled: false,
    durationMinutes: 5,
    windowStartHour: 19,
    windowEndHour: 23,
  },
};

/** Espeja `defaultShopSettings` del catálogo, para lo que se ve mientras carga. */
const DEFAULT_SHOP: ShopRulesInput = {
  enabled: false,
  precios: {},
  apagados: [],
  exentosMute: [],
  muteVictimCooldownSeconds: 1800,
  muteGraceSeconds: 300,
  vaultBase: 1000,
};

/** Un entero de un campo de texto, sin dejar que un borrado momentaneo escriba
 * NaN en el estado. */
const intOr = (raw: string, fallback: number): number => {
  const value = Number.parseInt(raw, 10);
  return Number.isInteger(value) ? value : fallback;
};

const ERROR_LABELS: Record<string, string> = {
  "not-admin": "Solo los administradores del grupo pueden ver esto.",
  "invalid-body": "Revisa los valores e intenta de nuevo.",
};

const humanError = (message: string): string =>
  ERROR_LABELS[message] ?? message;

function EconomiaInner() {
  const router = useRouter();
  const search = useSearchParams();
  const gid = search.get("gid") ?? "";

  const [currency, setCurrency] =
    useState<GroupCurrencyInput>(DEFAULT_CURRENCY);
  const [rules, setRules] = useState<EconomyRulesInput>(DEFAULT_RULES);
  const [shop, setShop] = useState<ShopRulesInput>(DEFAULT_SHOP);
  const [catalogo, setCatalogo] = useState<ShopCatalogItem[]>([]);
  /**
   * Los exentos como TEXTO mientras se escriben.
   *
   * No se puede filtrar en cada tecla contra el estado ya parseado: al escribir
   * la coma que separa dos ids, el filtro la tiraba por no ser un numero y el
   * campo se quedaba igual — o sea que era imposible meter mas de uno. Se
   * guarda lo que se teclea y se convierte a ids al guardar.
   */
  const [exentosTexto, setExentosTexto] = useState("");
  const [cargando, setCargando] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useBackButton(() => router.back());

  useEffect(() => {
    ready();
    if (!gid) {
      setError("Abre esta pantalla desde tu grupo.");
      setCargando(false);
      return;
    }
    void Promise.all([
      getGroupCurrency(gid).catch(() => DEFAULT_CURRENCY),
      getEconomyRules(gid).catch(() => DEFAULT_RULES),
      getShopRules(gid).catch(() => ({ shop: DEFAULT_SHOP, catalogo: [] })),
    ])
      .then(([moneda, reglas, tienda]) => {
        setCurrency(moneda);
        setRules(reglas);
        setShop(tienda.shop);
        setExentosTexto(tienda.shop.exentosMute.join(", "));
        setCatalogo(tienda.catalogo);
      })
      .finally(() => setCargando(false));
  }, [gid]);

  /**
   * Guarda moneda y reglas de una vez.
   *
   * Un solo boton para las tres secciones a proposito: son un sistema, no tres
   * ajustes sueltos. Encender el robo sin encender la moneda no hace nada, y
   * obligar a guardar tres veces era la forma mas facil de dejarse una a medias.
   */
  const guardar = useCallback(async () => {
    if (busy || !gid) {
      return;
    }
    setBusy(true);
    setError(null);
    setSaved(false);
    try {
      // El texto de los exentos se convierte a ids AQUI, no mientras se
      // escribe. Lo que no parezca un id de Telegram se descarta en silencio:
      // el servidor lo volveria a descartar igual, y el campo devuelve la lista
      // ya limpia para que se vea lo que ha quedado.
      const exentosMute = exentosTexto
        .split(",")
        .map((x) => x.trim())
        .filter((x) => /^-?\d{1,20}$/u.test(x));
      const [moneda, reglas, tienda] = await Promise.all([
        updateGroupCurrency(gid, currency),
        updateEconomyRules(gid, rules),
        updateShopRules(gid, { ...shop, exentosMute }),
      ]);
      // Lo aplicado puede no ser lo enviado: el nombre pasa por un saneado y una
      // ventana horaria que no avanza se rechaza entera. El admin tiene que ver
      // lo que de verdad ha quedado.
      const { persisted: _p, ...monedaAplicada } = moneda;
      setCurrency(monedaAplicada);
      setRules({ steal: reglas.steal, purge: reglas.purge });
      setShop(tienda.shop);
      setExentosTexto(tienda.shop.exentosMute.join(", "));
      setSaved(true);
      haptic.notify("success");
    } catch (e) {
      setError(humanError(e instanceof Error ? e.message : "error"));
      haptic.notify("error");
    } finally {
      setBusy(false);
    }
  }, [busy, currency, exentosTexto, gid, rules, shop]);

  const campoMoneda = (
    label: string,
    key:
      | "porMensaje"
      | "cupoDiario"
      | "minCaracteres"
      | "cooldownSegundos"
      | "premioPartida"
      | "monedasPorFicha"
      | "comisionVentaPct",
    hint?: string,
  ) => (
    <Field label={label} {...(hint ? { hint } : {})}>
      <input
        className="input"
        type="number"
        min={0}
        value={currency[key]}
        onChange={(e) =>
          setCurrency((prev) => ({
            ...prev,
            [key]: intOr(e.target.value, prev[key]),
          }))
        }
      />
    </Field>
  );

  const campoRobo = (
    label: string,
    key: keyof EconomyRulesInput["steal"],
    hint?: string,
  ) => (
    <Field label={label} {...(hint ? { hint } : {})}>
      <input
        className="input"
        type="number"
        min={0}
        value={rules.steal[key] as number}
        onChange={(e) =>
          setRules((prev) => ({
            ...prev,
            steal: {
              ...prev.steal,
              [key]: intOr(e.target.value, prev.steal[key] as number),
            },
          }))
        }
      />
    </Field>
  );

  const campoPurga = (
    label: string,
    key: "durationMinutes" | "windowStartHour" | "windowEndHour",
    hint?: string,
  ) => (
    <Field label={label} {...(hint ? { hint } : {})}>
      <input
        className="input"
        type="number"
        min={0}
        value={rules.purge[key]}
        onChange={(e) =>
          setRules((prev) => ({
            ...prev,
            purge: {
              ...prev.purge,
              [key]: intOr(e.target.value, prev.purge[key]),
            },
          }))
        }
      />
    </Field>
  );

  return (
    <Screen>
      <AppHeader
        glyph="€"
        tone="teal"
        title="Economía del grupo"
        subtitle="Moneda propia, donaciones, robos y la purga"
      />

      {error && <Banner kind="error">{error}</Banner>}
      {saved && <Banner kind="success">Cambios aplicados.</Banner>}

      {cargando ? (
        <SkeletonList rows={5} />
      ) : (
        <>
          <Section caption="La moneda">
            <Group>
              <Row
                icon="🪙"
                tone="teal"
                title="Moneda activada"
                subtitle="Sin esto no se gana nada y el resto de la pantalla no hace nada"
                trailing={
                  <Toggle
                    checked={currency.enabled}
                    label="Moneda activada"
                    onChange={(next) =>
                      setCurrency((prev) => ({ ...prev, enabled: next }))
                    }
                  />
                }
              />
              <Field
                label="Nombre"
                hint="En plural, como se dirá en el chat: monedas, pavos, chapas…"
              >
                <input
                  className="input"
                  value={currency.nombre}
                  maxLength={64}
                  onChange={(e) =>
                    setCurrency((prev) => ({ ...prev, nombre: e.target.value }))
                  }
                  placeholder="monedas"
                />
              </Field>
              <Field
                label="Símbolo"
                hint={`Un emoji corto que acompaña a las cifras. Así se verá: 1.000 ${currency.simbolo} ${currency.nombre}`}
              >
                <input
                  className="input"
                  value={currency.simbolo}
                  maxLength={16}
                  onChange={(e) =>
                    setCurrency((prev) => ({
                      ...prev,
                      simbolo: e.target.value,
                    }))
                  }
                  placeholder="🪙"
                />
              </Field>
            </Group>
          </Section>

          <Section caption="Cómo se gana">
            <Group>
              {campoMoneda(
                "Monedas por mensaje",
                "porMensaje",
                "Lo que se lleva cada mensaje que cuenta.",
              )}
              {campoMoneda(
                "Máximo al día",
                "cupoDiario",
                "Techo de lo que se puede ganar hablando en un día. Con 1 por mensaje, 200 son 200 mensajes: inalcanzable hablando normal, y corta en seco a quien automatice.",
              )}
              {campoMoneda(
                "Longitud mínima del mensaje",
                "minCaracteres",
                "Caracteres. Un mensaje más corto no cuenta: deja fuera los «ok» y los «jaja».",
              )}
              {campoMoneda(
                "Espera entre ganancias",
                "cooldownSegundos",
                "Segundos entre dos ganancias de la misma persona. Impide convertir una ráfaga de mensajes en una nómina.",
              )}
            </Group>
          </Section>

          <Section caption="Premios y cambio con el casino">
            <Group>
              {campoMoneda(
                "Premio por ganar una partida",
                "premioPartida",
                "Al conecta 4 o al piedra-papel-tijera. 0 = sin premio.",
              )}
              {campoMoneda(
                "Precio de una ficha de casino",
                "monedasPorFicha",
                "Monedas que cuesta 1 ficha con /comprarfichas. 0 = no se pueden comprar fichas con moneda del grupo.",
              )}
              {campoMoneda(
                "Comisión al vender fichas (%)",
                "comisionVentaPct",
                "Lo que se queda la casa con /venderfichas. Evita comprar barato en un grupo y vender caro en otro.",
              )}
            </Group>
            <GroupNote>
              Las fichas compradas con Telegram Stars nunca se cambian por
              moneda del grupo: es lo que impide que a alguien le roben lo que
              pagó con dinero real.
            </GroupNote>
          </Section>

          <Section caption="Robar">
            <Group>
              <Row
                icon="🥷"
                tone="red"
                title="Robar activado"
                subtitle="Deja usar /robar entre miembros del grupo"
                trailing={
                  <Toggle
                    checked={rules.steal.enabled}
                    label="Robar activado"
                    onChange={(next) =>
                      setRules((prev) => ({
                        ...prev,
                        steal: { ...prev.steal, enabled: next },
                      }))
                    }
                  />
                }
              />
            </Group>
          </Section>

          <Section caption="Robar · probabilidad de acertar">
            <Group>
              {campoRobo(
                "Al empezar (%)",
                "baseChancePct",
                "De cada 100 intentos, cuántos salen bien para quien no ha robado nunca.",
              )}
              {campoRobo(
                "Sube por cada golpe acertado (%)",
                "chancePerLevelPct",
                "La veteranía suma. Con 2, al décimo robo con éxito se acierta un 20 % más.",
              )}
              {campoRobo(
                "Tope (%)",
                "maxChancePct",
                "Sin este techo, quien lleva mucho robando acierta siempre y deja de ser una apuesta.",
              )}
            </Group>
          </Section>

          <Section caption="Robar · cuánto se gana y cuánto cuesta fallar">
            <Group>
              {campoRobo(
                "Botín (% del saldo de la víctima)",
                "lootPct",
                "Sobre lo que tiene fuera de la caja fuerte, no sobre el saldo entero.",
              )}
              {campoRobo(
                "Botín máximo",
                "lootMax",
                "Tope por golpe, pase lo que pase.",
              )}
              {campoRobo(
                "Multa al fallar (% del saldo del ladrón)",
                "finePct",
                "Se la lleva la víctima como compensación.",
              )}
              {campoRobo("Multa máxima", "fineMax")}
            </Group>
          </Section>

          <Section caption="Robar · esperas y protecciones">
            <Group>
              {campoRobo(
                "Espera entre golpes (s)",
                "cooldownSeconds",
                "Segundos que tiene que esperar la misma persona para volver a robar.",
              )}
              {campoRobo(
                "Escudo de la víctima (s)",
                "victimShieldSeconds",
                "Segundos que queda a salvo alguien después de que le roben. Evita que se ceben con la misma persona.",
              )}
              {campoRobo(
                "Saldo mínimo para ser objetivo",
                "minVictimBalance",
                "Por debajo de esto no se le puede robar a nadie: cebarse con quien no tiene nada es la forma más rápida de que deje de jugar.",
              )}
            </Group>
          </Section>

          <Section caption="La purga">
            <Group>
              <Row
                icon="😈"
                tone="orange"
                title="Purga activada"
                subtitle="Unos minutos al día, a una hora que nadie sabe, en los que robar es barra libre"
                trailing={
                  <Toggle
                    checked={rules.purge.enabled}
                    label="Purga activada"
                    onChange={(next) =>
                      setRules((prev) => ({
                        ...prev,
                        purge: { ...prev.purge, enabled: next },
                      }))
                    }
                  />
                }
              />
              {campoPurga(
                "Cuánto dura (min)",
                "durationMinutes",
                "Durante ese rato las esperas se acortan, los escudos no valen y sube la probabilidad.",
              )}
              {campoPurga(
                "Puede caer desde (hora UTC)",
                "windowStartHour",
                "La hora exacta se sortea cada día dentro de esta franja. Una hora fija se convierte en una alarma: la gente aparece un minuto antes, roba y se va.",
              )}
              {campoPurga(
                "Hasta (hora UTC)",
                "windowEndHour",
                "Tiene que ser mayor que la de inicio; cruzar medianoche no vale.",
              )}
            </Group>
            <GroupNote>
              Ojo, en <strong>UTC</strong>, no en hora de España: ahora mismo
              aquí son dos horas más.
            </GroupNote>
          </Section>

          <Section caption="La tienda">
            <Group>
              <Row
                icon="🛒"
                tone="green"
                title="Tienda abierta"
                subtitle="Deja gastar la moneda en objetos: navajas, escudos, mordazas…"
                trailing={
                  <Toggle
                    checked={shop.enabled}
                    label="Tienda abierta"
                    onChange={(v) =>
                      setShop((prev) => ({ ...prev, enabled: v }))
                    }
                  />
                }
              />
            </Group>
            <GroupNote>
              Antes de abrirla, rellena abajo quién no puede recibir mordazas.
              Si esa lista está vacía, se puede pagar por silenciar a quien
              modera.
            </GroupNote>
            <Group>
              <Field
                label="Tope básico de la caja fuerte"
                hint="Lo que cabe sin comprar ampliaciones. Sin tope, guardarlo todo haría a cualquiera intocable y el robo dejaría de existir."
              >
                <input
                  className="input"
                  type="number"
                  min={0}
                  value={shop.vaultBase}
                  onChange={(e) =>
                    setShop((prev) => ({
                      ...prev,
                      vaultBase: intOr(e.target.value, prev.vaultBase),
                    }))
                  }
                />
              </Field>
              <Field
                label="Espera entre mordazas a la misma persona (s)"
                hint="Evita que se pueda acosar a una sola persona a base de saldo."
              >
                <input
                  className="input"
                  type="number"
                  min={0}
                  value={shop.muteVictimCooldownSeconds}
                  onChange={(e) =>
                    setShop((prev) => ({
                      ...prev,
                      muteVictimCooldownSeconds: intOr(
                        e.target.value,
                        prev.muteVictimCooldownSeconds,
                      ),
                    }))
                  }
                />
              </Field>
              <Field
                label="Gracia al salir de una mordaza (s)"
                hint="Sin esto, dos personas con saldo se turnan y una tercera no vuelve a hablar en toda la tarde."
              >
                <input
                  className="input"
                  type="number"
                  min={0}
                  value={shop.muteGraceSeconds}
                  onChange={(e) =>
                    setShop((prev) => ({
                      ...prev,
                      muteGraceSeconds: intOr(
                        e.target.value,
                        prev.muteGraceSeconds,
                      ),
                    }))
                  }
                />
              </Field>
              <Field
                label="Nadie les puede comprar mordaza"
                hint="Ids de Telegram separados por comas. A los administradores ya los protege Telegram, no hace falta ponerlos. Esto es para quien modera sin ser admin del grupo."
              >
                <input
                  className="input"
                  inputMode="numeric"
                  placeholder="123456789, 987654321"
                  value={exentosTexto}
                  onChange={(e) => setExentosTexto(e.target.value)}
                />
              </Field>
            </Group>

            {/* Sin catálogo no se pintan los dos bloques de objetos. Si no,
                salen dos títulos vacíos con una nota debajo flotando, que
                parece la pantalla rota — y es justo lo que se ve cuando la
                petición del catálogo falla. */}
            {catalogo.length === 0 ? (
              <GroupNote>
                No he podido cargar la lista de objetos. Los precios y qué se
                vende se editan volviendo a abrir esta pantalla.
              </GroupNote>
            ) : (
              <>
                <Section caption={`Precios, en ${currency.nombre}`}>
                  <Group>
                    {/* La fianza no entra: su precio es el doble de la mordaza que
                    te cayó, así que aquí solo podía salir un 0 desactivado que
                    no significa nada y que encima parece un precio de verdad. */}
                    {catalogo
                      .filter((item) => !item.precioDinamico)
                      .map((item) => (
                        <Field
                          key={item.id}
                          label={`${item.icono} ${item.nombre}`}
                        >
                          <input
                            className="input"
                            type="number"
                            min={0}
                            value={shop.precios[item.id] ?? item.precio}
                            onChange={(e) =>
                              setShop((prev) => ({
                                ...prev,
                                precios: {
                                  ...prev.precios,
                                  [item.id]: intOr(
                                    e.target.value,
                                    prev.precios[item.id] ?? item.precio,
                                  ),
                                },
                              }))
                            }
                          />
                        </Field>
                      ))}
                  </Group>
                  <GroupNote>
                    La fianza no tiene precio fijo: cuesta el doble de la
                    mordaza que te hayan comprado.
                  </GroupNote>
                </Section>

                <Section caption="Qué se vende">
                  <Group>
                    {catalogo.map((item) => (
                      <Row
                        key={`on-${item.id}`}
                        icon={item.icono}
                        title={item.nombre}
                        trailing={
                          <Toggle
                            checked={!shop.apagados.includes(item.id)}
                            label={item.nombre}
                            onChange={(v) =>
                              setShop((prev) => ({
                                ...prev,
                                apagados: v
                                  ? prev.apagados.filter((x) => x !== item.id)
                                  : [...prev.apagados, item.id],
                              }))
                            }
                          />
                        }
                      />
                    ))}
                  </Group>
                  <GroupNote>
                    Apagar un objeto lo saca de la tienda. Lo que ya tenga la
                    gente comprado le sigue funcionando.
                  </GroupNote>
                </Section>
              </>
            )}
          </Section>

          <Button
            variant="primary"
            block
            disabled={busy}
            onClick={() => void guardar()}
          >
            {busy ? "Guardando..." : "Guardar economía"}
          </Button>
        </>
      )}
    </Screen>
  );
}

export default function EconomiaPage() {
  return (
    <Suspense
      fallback={
        <Screen>
          <SkeletonList rows={5} />
        </Screen>
      }
    >
      <EconomiaInner />
    </Suspense>
  );
}
