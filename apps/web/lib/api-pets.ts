// El cliente de mascotas.
//
// Una sola llamada trae la pantalla entera —el bicho, el saldo y el corral—
// porque la pantalla no sirve de nada a medias: el bicho sin el saldo no puede
// decir si se le puede dar de comer.

import { apiFetch } from "./api";

export interface MascotaDto {
  especie: string;
  nombreEspecie: string;
  descripcion: string;
  familia: string;
  glifo: string;
  nombre: string | null;
  cara: string;
  /** El retrato ya compuesto, para no tener que conocer el catalogo aqui. */
  retrato: string;
  hambre: number;
  animo: number;
  nivel: number;
  progreso: number;
  rasgos: string[];
  racionesHoy: number;
  haJugadoHoy: boolean;
  regalada: boolean;
  usuario: string;
}

export interface CorralDto extends MascotaDto {
  esMia: boolean;
}

export interface VistaDeMascotasDto {
  activo: boolean;
  saldo: number;
  precioRacion: number;
  racionesPorDia: number;
  precioHuevo: number;
  mia: MascotaDto | null;
  corral: CorralDto[];
}

export const getMascotas = () => apiFetch<VistaDeMascotasDto>("/v1/pets");

export const alimentarMascota = () =>
  apiFetch<{
    ok: boolean;
    motivo?: "sinSaldo" | "topeDiario" | "yaLlena";
    saldo?: number;
    coste?: number;
    racionesHoy?: number;
  }>("/v1/pets/feed", { method: "POST" });

export const jugarConMascota = () =>
  apiFetch<{
    ok: boolean;
    motivo?: "yaHoy";
    animo?: number;
    subida?: number;
  }>("/v1/pets/play", { method: "POST" });

export const conseguirMascota = () =>
  apiFetch<{
    ok: boolean;
    motivo?: "yaTiene" | "sinSaldo";
    especie?: string;
    gratis?: boolean;
    precio?: number;
  }>("/v1/pets/hatch", { method: "POST" });
