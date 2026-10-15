"use client";

// La tienda del grupo. Entra por `startapp=shop_<grupo>` y el servidor resuelve
// el grupo de ahi: esta pantalla nunca manda un id de grupo, porque un id que
// manda el cliente no prueba nada.

import { useCallback, useEffect, useState } from "react";
import {
  AppHeader,
  Banner,
  Button,
  Empty,
  Field,
  Group,
  GroupNote,
  Row,
  Screen,
  Section,
  SkeletonList,
  type Tone,
  useBackButton,
} from "../../components/ui";
import {
  buyShopItem,
  getShop,
  moveShopVault,
  type ShopItemDto,
  type ShopViewDto,
} from "../../lib/api";
import { haptic, ready } from "../../lib/telegram";

const TITULOS: Record<ShopItemDto["familia"], string> = {
  ataque: "Para robar",
  defensa: "Para defenderte",
  economia: "Economía",
  castigo: "Castigo",
  vanidad: "Vanidad",
};

const TONOS: Record<ShopItemDto["familia"], Tone> = {
  ataque: "red",
  defensa: "blue",
  economia: "green",
  castigo: "orange",
  vanidad: "purple",
};

const ORDEN: ShopItemDto["familia"][] = [
  "ataque",
  "defensa",
  "economia",
  "castigo",
  "vanidad",
];

/** Mensajes de rechazo del servidor, en cristiano. */
const ERRORES: Record<string, string> = {
  disabled: "La tienda de este grupo está cerrada.",
  "item-off": "Eso no se vende en este grupo.",
  insufficient: "No te llega.",
  "needs-payload": "Escribe el texto primero.",
  "not-for-sale-here": "Eso se compra desde el chat del grupo.",
  full: "No cabe más en la caja fuerte.",
  empty: "No tienes tanto guardado.",
};

const miles = (n: number): string =>
  Math.trunc(n)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/gu, ".");

export default function TiendaPage() {
  const [data, setData] = useState<ShopViewDto | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [textos, setTextos] = useState<Record<string, string>>({});

  useBackButton();

  const cargar = useCallback(async () => {
    try {
      setData(await getShop());
      setError(null);
    } catch {
      setError("No he podido abrir la tienda. Ábrela desde el grupo.");
    }
  }, []);

  useEffect(() => {
    ready();
    void cargar();
  }, [cargar]);

  const comprar = async (item: ShopItemDto) => {
    if (item.pidePayload && !textos[item.id]?.trim()) {
      setAviso("Escribe el texto primero.");
      return;
    }
    setOcupado(item.id);
    setAviso(null);
    try {
      const res = await buyShopItem(item.id, textos[item.id]?.trim());
      if (!res.ok) {
        haptic.notify("error");
        setAviso(ERRORES[res.error ?? ""] ?? "No ha podido ser.");
      } else {
        haptic.notify("success");
        setAviso(`${item.icono} ${item.nombre}: comprado.`);
        setTextos((previo) => ({ ...previo, [item.id]: "" }));
      }
      await cargar();
    } catch {
      setAviso("No se pudo conectar. Inténtalo de nuevo.");
    } finally {
      setOcupado(null);
    }
  };

  const caja = async (amount: number) => {
    setOcupado("vault");
    setAviso(null);
    try {
      const res = await moveShopVault(amount);
      if (!res.ok) {
        haptic.notify("error");
        setAviso(ERRORES[res.error ?? ""] ?? "No ha podido ser.");
      } else {
        haptic.notify("success");
      }
      await cargar();
    } catch {
      setAviso("No se pudo conectar. Inténtalo de nuevo.");
    } finally {
      setOcupado(null);
    }
  };

  if (error) {
    return (
      <Screen>
        <AppHeader title="Tienda" />
        <Empty icon="🛒" title="Aquí no hay tienda" hint={error} />
      </Screen>
    );
  }

  if (!data) {
    return (
      <Screen>
        <AppHeader title="Tienda" />
        <SkeletonList rows={5} />
      </Screen>
    );
  }

  if (!data.enabled) {
    return (
      <Screen>
        <AppHeader title="Tienda" />
        <Empty
          icon="🔒"
          title="Cerrada"
          hint="Un admin puede abrirla desde /settings → Economía y juegos."
        />
      </Screen>
    );
  }

  const { currency, vault } = data;
  const libre = vault.expuesto;

  return (
    <Screen>
      <AppHeader
        title="Tienda"
        subtitle={`${miles(data.balance)} ${currency.simbolo} ${currency.nombre}`}
      />

      {aviso && <Banner kind="info">{aviso}</Banner>}

      <Section caption="Caja fuerte">
        <Group>
          <Row
            icon="🔐"
            tone="green"
            title="A salvo de robos"
            subtitle={
              vault.sinTope
                ? `Sin límite ∞. Expuesto: ${miles(libre)}.`
                : `Tope: ${miles(vault.tope)}. Expuesto: ${miles(libre)}.`
            }
            value={miles(vault.guardado)}
          />
        </Group>
        <Button
          variant="secondary"
          block
          disabled={
            ocupado !== null || libre <= 0 || vault.guardado >= vault.tope
          }
          onClick={() =>
            void caja(Math.min(libre, vault.tope - vault.guardado))
          }
        >
          Guardar todo lo que cabe
        </Button>
        <Button
          variant="secondary"
          block
          disabled={ocupado !== null || vault.guardado <= 0}
          onClick={() => void caja(-vault.guardado)}
        >
          Sacar todo
        </Button>
        <GroupNote>
          Lo que está dentro no te lo puede robar nadie.{" "}
          {vault.sinTope
            ? "Tu caja no tiene límite: te cabe todo."
            : "El tope se amplía comprando la ampliación."}
        </GroupNote>
      </Section>

      {data.inventario.length > 0 && (
        <Section caption="Lo que tienes">
          <Group>
            {data.inventario.map((o) => (
              <Row
                key={o.id}
                icon={o.icono}
                title={o.nombre}
                subtitle={o.texto ? `«${o.texto}»` : undefined}
                value={
                  o.restante ?? `${o.usos} ${o.usos === 1 ? "uso" : "usos"}`
                }
              />
            ))}
          </Group>
        </Section>
      )}

      {ORDEN.map((familia) => {
        const bloque = data.items.filter((i) => i.familia === familia);
        if (bloque.length === 0) {
          return null;
        }
        return (
          <Section key={familia} caption={TITULOS[familia]}>
            <Group>
              {bloque.map((item) => (
                <Row
                  key={item.id}
                  icon={item.icono}
                  tone={TONOS[familia]}
                  title={item.nombre}
                  subtitle={item.resumen}
                  value={item.precio === null ? "—" : miles(item.precio)}
                  trailing={
                    item.comprableAqui ? (
                      <Button
                        variant="secondary"
                        disabled={
                          ocupado !== null || (item.precio ?? 0) > data.balance
                        }
                        onClick={() => void comprar(item)}
                      >
                        {ocupado === item.id ? "…" : "Comprar"}
                      </Button>
                    ) : undefined
                  }
                />
              ))}
            </Group>
            {bloque.some((i) => i.pidePayload) && (
              <Group>
                {bloque
                  .filter((i) => i.pidePayload)
                  .map((item) => (
                    <Field
                      key={`txt-${item.id}`}
                      label={`Texto para ${item.nombre}`}
                    >
                      <input
                        className="input"
                        value={textos[item.id] ?? ""}
                        maxLength={20}
                        onChange={(e) =>
                          setTextos((previo) => ({
                            ...previo,
                            [item.id]: e.target.value,
                          }))
                        }
                      />
                    </Field>
                  ))}
              </Group>
            )}
            {bloque.some((i) => !i.comprableAqui) && (
              <GroupNote>
                Lo que le cae encima a otra persona se compra desde el chat, con
                <code> /comprar</code>: el grupo tiene que ver quién lo ha
                pagado.
              </GroupNote>
            )}
          </Section>
        );
      })}
    </Screen>
  );
}
