"use client";

// La mascota del grupo. Entra por `startapp=pet_<grupo>` y el servidor resuelve
// el grupo de ahi: esta pantalla nunca manda un id de grupo, porque un id que
// manda el cliente no prueba nada.
//
// El retrato llega compuesto desde la API como SVG. Es lo que evita que esta
// pantalla tenga que conocer el catalogo de especies para pintar un bicho — y
// lo que hace que añadir una especie nueva no toque ni una linea de aqui.

import { useCallback, useEffect, useState } from "react";
import { Corral, FichaDeMascota, SinMascota } from "../../components/mascota";
import {
  AppHeader,
  Banner,
  Empty,
  Screen,
  SkeletonList,
  useBackButton,
} from "../../components/ui";
import {
  alimentarMascota,
  conseguirMascota,
  getMascotas,
  jugarConMascota,
  type VistaDeMascotasDto,
} from "../../lib/api-pets";
import { haptic, ready } from "../../lib/telegram";

export default function PaginaDeMascota() {
  const [vista, setVista] = useState<VistaDeMascotasDto | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);

  useBackButton();

  const cargar = useCallback(async () => {
    try {
      setVista(await getMascotas());
      setError(null);
    } catch {
      setError(
        "No he podido cargar tu bicho. Vuelve a abrirlo desde el grupo.",
      );
    }
  }, []);

  useEffect(() => {
    ready();
    void cargar();
  }, [cargar]);

  const alimentar = async () => {
    setOcupado(true);
    haptic.impact("medium");
    try {
      const salida = await alimentarMascota();
      if (salida.ok) {
        setAviso(`Ha comido. Te ha costado ${salida.coste} monedas.`);
      } else if (salida.motivo === "yaLlena") {
        setAviso("Está lleno. Guárdate las monedas.");
      } else if (salida.motivo === "topeDiario") {
        setAviso("Ya ha comido bastante por hoy. Mañana más.");
      } else {
        setAviso("No te llega para una ración.");
      }
      await cargar();
    } catch {
      setAviso("No he podido darle de comer.");
    } finally {
      setOcupado(false);
    }
  };

  const jugar = async () => {
    setOcupado(true);
    haptic.impact("medium");
    try {
      const salida = await jugarConMascota();
      if (salida.ok) {
        // Se redondea al enseñarlo: el animo se guarda como decimal porque el
        // desgaste sale de milisegundos, y sin esto aparece un 39.90017416.
        setAviso(
          `Habéis jugado un rato. Ánimo +${Math.round(salida.subida ?? 0)}.`,
        );
      } else {
        setAviso("Ya habéis jugado hoy. Mañana otra vez.");
      }
      await cargar();
    } catch {
      setAviso("No he podido jugar con él.");
    } finally {
      setOcupado(false);
    }
  };

  const conseguir = async () => {
    setOcupado(true);
    haptic.impact("medium");
    try {
      const salida = await conseguirMascota();
      setAviso(
        salida.ok
          ? "¡Ha salido del huevo!"
          : salida.motivo === "yaTiene"
            ? "Ya tienes un bicho."
            : "No te llega para un huevo.",
      );
      await cargar();
    } catch {
      setAviso("No he podido abrir el huevo.");
    } finally {
      setOcupado(false);
    }
  };

  if (error) {
    return (
      <Screen>
        <AppHeader title="Tu bicho" />
        <Banner kind="error">{error}</Banner>
      </Screen>
    );
  }

  if (!vista) {
    return (
      <Screen>
        <AppHeader title="Tu bicho" />
        <SkeletonList rows={3} />
      </Screen>
    );
  }

  if (!vista.activo) {
    return (
      <Screen>
        <AppHeader title="Tu bicho" />
        <Empty
          icon="🥚"
          title="Las mascotas están apagadas aquí"
          hint="Un administrador del grupo puede encenderlas."
        />
      </Screen>
    );
  }

  const mia = vista.mia;

  return (
    <Screen>
      <AppHeader title="Tu bicho" subtitle={`${vista.saldo} monedas`} />

      {aviso ? <Banner kind="info">{aviso}</Banner> : null}

      {mia ? (
        <FichaDeMascota
          mascota={mia}
          precioRacion={vista.precioRacion}
          racionesPorDia={vista.racionesPorDia}
          ocupado={ocupado}
          onAlimentar={alimentar}
          onJugar={jugar}
        />
      ) : (
        <SinMascota
          precioHuevo={vista.precioHuevo}
          ocupado={ocupado}
          onConseguir={conseguir}
        />
      )}

      <Corral entradas={vista.corral} />
    </Screen>
  );
}
