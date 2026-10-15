// Recorta la hoja de sprites de mascotas en un PNG por especie.
//
//   node scripts/recortar-mascotas.mjs <hoja.png> [destino] [ids,separados,por,comas]
//
// Sin la lista de ids recorta el catalogo entero (los 30). Con ella, solo esos
// y en ese orden: es como entran las tandas nuevas —las seis del staff, o las
// especies que se añadan despues— sin tocar el script.
//
// **No recorta por rejilla fija**, y es a proposito: el generador de imagenes
// no coloca las criaturas en una cuadricula perfecta —las filas de cuatro y las
// de cinco quedan con separaciones distintas— asi que un recorte por celdas
// parte bichos por la mitad. Lo que hace es buscar las siluetas: agrupa los
// pixeles opacos en manchas conectadas y recorta cada una.
//
// Dos detalles que no son obvios y sin los cuales sale mal:
//
// 1. **Solo se fusiona si SOBRAN manchas**, y con la menor distancia que
//    cuadre. Las partes sueltas —las antenas de la abeja, la ramita de la
//    paloma, el chorro de la ballena— hay que unirlas al cuerpo, pero fusionar
//    siempre es peor que no fusionar nunca: las cajas de dos bichos vecinos se
//    solapan aunque sus siluetas no se toquen, porque una silueta irregular
//    invade el rectangulo del de al lado. Con la primera hoja, fusionar a 14 px
//    dejaba UNA mancha con los treinta dentro.
// 2. **El orden sale de la posicion, no del recorrido.** Se agrupan por bandas
//    horizontales y dentro de cada banda por la x, que es como se lee la hoja.
//    Recorrer los pixeles de arriba abajo daria un orden casi correcto y
//    "casi" aqui significa nombres cambiados entre dos bichos.

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const raiz = resolve(dirname(fileURLToPath(import.meta.url)), "..");

/** Un pixel cuenta como dibujo a partir de esta opacidad. */
const ALFA_MINIMO = 24;

/** Manchas mas pequeñas que esto son ruido del generador, no criaturas. */
const AREA_MINIMA = 900;

/** Distancias que se prueban, de menor a mayor, si sobran manchas. */
const CERCANIAS = [0, 2, 4, 6, 8, 10, 12];

/** Margen transparente alrededor del recorte, en px de la hoja. */
const MARGEN = 8;

/**
 * Islas mas pequeñas que este % de la mayor se borran del PNG final.
 *
 * Hace falta porque el redimensionado interpola los bordes y deja trocitos del
 * bicho de al lado que la mascara habia dejado casi a cero. Medido en la
 * primera hoja: al elefante le quedaban restos de 183, 53 y 6 px junto a un
 * cuerpo de 35.335 (0,5%), mientras que la cola del loro —que SI es suya— es
 * un 3,8%. El uno por ciento separa las dos cosas con holgura.
 */
const ISLA_MINIMA_RELATIVA = 0.01;

/** Lado del PNG de salida. */
const LADO = 256;

/**
 * Los 30, en el orden en que estan en la hoja: por filas, y dentro de cada
 * fila de izquierda a derecha. Si el generador cambia el orden, esta lista es
 * lo unico que hay que tocar.
 */
const NOMBRES = [
  "abeja",
  "ardilla",
  "hormiga",
  "cerdito",
  "zorro",
  "mapache",
  "murcielago",
  "serpiente",
  "tortuga",
  "caracol",
  "erizo",
  "castor",
  "buho",
  "elefante",
  "loro",
  "pulpo",
  "perro",
  "gato",
  "paloma",
  "oveja",
  "pollito",
  "rana",
  "pato",
  "camaleon",
  "gatonegro",
  "dragon",
  "lobo",
  "aguila",
  "ballena",
  "cisne",
];

/** Etiqueta manchas conectadas de pixeles opacos. Pila propia, sin recursion. */
const buscarManchas = (mascara, ancho, alto, areaMinima = AREA_MINIMA) => {
  const visto = new Uint8Array(ancho * alto);
  // Que mancha ocupa cada pixel, 1..n (0 = fondo). Sirve para borrar del
  // recorte lo que sea del bicho de al lado.
  const etiqueta = new Int32Array(ancho * alto);
  const cajas = [];
  const pila = new Int32Array(ancho * alto);
  let siguienteId = 0;

  for (let inicio = 0; inicio < mascara.length; inicio += 1) {
    if (!mascara[inicio] || visto[inicio]) {
      continue;
    }
    siguienteId += 1;
    const id = siguienteId;
    let tope = 0;
    pila[tope++] = inicio;
    visto[inicio] = 1;
    etiqueta[inicio] = id;
    let x0 = ancho;
    let y0 = alto;
    let x1 = 0;
    let y1 = 0;
    let area = 0;

    while (tope > 0) {
      const p = pila[--tope];
      const x = p % ancho;
      const y = (p - x) / ancho;
      area += 1;
      if (x < x0) x0 = x;
      if (y < y0) y0 = y;
      if (x > x1) x1 = x;
      if (y > y1) y1 = y;

      // Ocho vecinos: con cuatro, una linea diagonal de un pixel parte la
      // silueta en dos manchas.
      for (let dy = -1; dy <= 1; dy += 1) {
        for (let dx = -1; dx <= 1; dx += 1) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= ancho || ny >= alto) continue;
          const q = ny * ancho + nx;
          if (mascara[q] && !visto[q]) {
            visto[q] = 1;
            etiqueta[q] = id;
            pila[tope++] = q;
          }
        }
      }
    }

    if (area >= areaMinima) {
      cajas.push({ x0, y0, x1, y1, area, ids: [id] });
    }
  }
  return { cajas, etiqueta };
};

const seTocan = (a, b, d) =>
  a.x0 - d <= b.x1 && b.x0 - d <= a.x1 && a.y0 - d <= b.y1 && b.y0 - d <= a.y1;

/** Une las cajas cercanas hasta que ninguna toque a otra. */
const fusionar = (cajas, d) => {
  const lista = [...cajas];
  let cambio = true;
  while (cambio) {
    cambio = false;
    for (let i = 0; i < lista.length && !cambio; i += 1) {
      for (let j = i + 1; j < lista.length; j += 1) {
        if (seTocan(lista[i], lista[j], d)) {
          lista[i] = {
            x0: Math.min(lista[i].x0, lista[j].x0),
            y0: Math.min(lista[i].y0, lista[j].y0),
            x1: Math.max(lista[i].x1, lista[j].x1),
            y1: Math.max(lista[i].y1, lista[j].y1),
            area: lista[i].area + lista[j].area,
            ids: [...lista[i].ids, ...lista[j].ids],
          };
          lista.splice(j, 1);
          cambio = true;
          break;
        }
      }
    }
  }
  return lista;
};

/**
 * Ordena como se lee: por bandas horizontales, y dentro de cada banda por la x.
 *
 * La banda se decide con el centro vertical y una tolerancia de media altura
 * media: dos bichos de la misma fila nunca se separan tanto, y dos de filas
 * distintas nunca se acercan tanto.
 */
const ordenarComoSeLee = (cajas) => {
  const alturaMedia =
    cajas.reduce((s, c) => s + (c.y1 - c.y0), 0) / Math.max(1, cajas.length);
  const tolerancia = alturaMedia * 0.55;
  const porY = [...cajas].sort((a, b) => (a.y0 + a.y1) / 2 - (b.y0 + b.y1) / 2);

  const bandas = [];
  for (const caja of porY) {
    const centro = (caja.y0 + caja.y1) / 2;
    const banda = bandas.find((b) => Math.abs(b.centro - centro) < tolerancia);
    if (banda) {
      banda.items.push(caja);
      banda.centro =
        banda.items.reduce((s, c) => s + (c.y0 + c.y1) / 2, 0) /
        banda.items.length;
    } else {
      bandas.push({ centro, items: [caja] });
    }
  }
  return bandas.flatMap((b) =>
    b.items.sort((a, c) => (a.x0 + a.x1) / 2 - (c.x0 + c.x1) / 2),
  );
};

/**
 * Borra las islas sueltas mucho mas pequeñas que el cuerpo.
 *
 * Conserva la mayor y todo lo que llegue al umbral: las partes legitimamente
 * separadas —la cola del loro, el chorro de la ballena— son un orden de
 * magnitud mayores que los restos que deja el vecino.
 */
const limpiarIslas = (px, ancho, alto) => {
  const mascara = new Uint8Array(ancho * alto);
  for (let i = 0; i < mascara.length; i += 1) {
    mascara[i] = px[i * 4 + 3] >= ALFA_MINIMO ? 1 : 0;
  }
  const { cajas, etiqueta } = buscarManchas(mascara, ancho, alto, 1);
  if (cajas.length <= 1) {
    return px;
  }
  const mayor = Math.max(...cajas.map((c) => c.area));
  const buenos = new Set(
    cajas
      .filter((c) => c.area >= mayor * ISLA_MINIMA_RELATIVA)
      .flatMap((c) => c.ids),
  );
  for (let i = 0; i < mascara.length; i += 1) {
    if (mascara[i] && !buenos.has(etiqueta[i])) {
      px[i * 4 + 3] = 0;
    }
  }
  return px;
};

const main = async () => {
  const [hoja, destinoArg, idsArg] = process.argv.slice(2);
  if (!hoja) {
    console.error(
      "uso: node scripts/recortar-mascotas.mjs <hoja.png> [destino]",
    );
    process.exit(1);
  }
  const nombres = idsArg
    ? idsArg
        .split(",")
        .map((x) => x.trim())
        .filter(Boolean)
    : NOMBRES;
  const destino = destinoArg
    ? resolve(destinoArg)
    : join(raiz, "apps/web/public/mascotas");

  const imagen = sharp(readFileSync(hoja)).ensureAlpha();
  const { data, info } = await imagen
    .raw()
    .toBuffer({ resolveWithObject: true });

  const mascara = new Uint8Array(info.width * info.height);
  for (let i = 0; i < mascara.length; i += 1) {
    mascara[i] = data[i * info.channels + 3] >= ALFA_MINIMO ? 1 : 0;
  }

  const { cajas: crudas, etiqueta } = buscarManchas(
    mascara,
    info.width,
    info.height,
  );

  // Se fusiona lo justo: la primera distancia que deje el numero esperado. Si
  // ya salen los treinta, no se fusiona nada — es el caso normal cuando el
  // generador dibuja cada bicho de una pieza.
  let agrupadas = crudas;
  if (crudas.length > nombres.length) {
    for (const d of CERCANIAS) {
      const intento = fusionar(crudas, d);
      if (intento.length <= nombres.length) {
        agrupadas = intento;
        console.log(
          `  (fusionadas a ${d} px: ${crudas.length} -> ${intento.length})`,
        );
        break;
      }
      agrupadas = intento;
    }
  }

  const encontradas = ordenarComoSeLee(agrupadas);

  console.log(
    `hoja ${info.width}x${info.height} — ${encontradas.length} siluetas`,
  );
  if (encontradas.length !== nombres.length) {
    console.error(
      `esperaba ${nombres.length} y hay ${encontradas.length}. No se escribe nada:` +
        " con el numero mal, los nombres se asignarian corridos y cada bicho" +
        " saldria con el nombre de otro.",
    );
    for (const [i, c] of encontradas.entries()) {
      console.error(`  ${i}: ${c.x0},${c.y0} ${c.x1 - c.x0}x${c.y1 - c.y0}`);
    }
    process.exit(1);
  }

  mkdirSync(destino, { recursive: true });
  for (const [i, caja] of encontradas.entries()) {
    const left = Math.max(0, caja.x0 - MARGEN);
    const top = Math.max(0, caja.y0 - MARGEN);
    const width = Math.min(info.width - left, caja.x1 - caja.x0 + MARGEN * 2);
    const height = Math.min(info.height - top, caja.y1 - caja.y0 + MARGEN * 2);

    // Se borra lo que no sea de ESTE bicho. El recorte es un rectangulo y las
    // siluetas son irregulares, asi que la caja de uno se come un trozo del
    // vecino: sin esto, al elefante le sale flotando un ala del loro.
    const suyos = new Set(caja.ids);
    const region = Buffer.alloc(width * height * 4);
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const origen = ((top + y) * info.width + (left + x)) * info.channels;
        const salida = (y * width + x) * 4;
        const mia = suyos.has(etiqueta[(top + y) * info.width + (left + x)]);
        region[salida] = data[origen];
        region[salida + 1] = data[origen + 1];
        region[salida + 2] = data[origen + 2];
        region[salida + 3] = mia ? data[origen + 3] : 0;
      }
    }

    const escalado = await sharp(region, {
      raw: { width, height, channels: 4 },
    })
      // `contain` con fondo transparente: cuadrado sin deformar y sin recortar
      // lo que sobresalga. Un `cover` le cortaria las orejas al zorro.
      .resize(LADO, LADO, {
        fit: "contain",
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      })
      .raw()
      .toBuffer();

    // La limpieza va DESPUES de escalar: el redimensionado interpola los bordes
    // y resucita como semitransparentes trocitos que la mascara habia dejado a
    // cero.
    const png = await sharp(limpiarIslas(escalado, LADO, LADO), {
      raw: { width: LADO, height: LADO, channels: 4 },
    })
      .png({ compressionLevel: 9, palette: true })
      .toBuffer();

    const ruta = join(destino, `${nombres[i]}.png`);
    writeFileSync(ruta, png);
    console.log(
      `  ${nombres[i].padEnd(11)} ${String(width).padStart(4)}x${String(height).padEnd(4)} -> ${(png.length / 1024).toFixed(1)} KB`,
    );
  }
  console.log(`\n${encontradas.length} mascotas en ${destino}`);
};

await main();
