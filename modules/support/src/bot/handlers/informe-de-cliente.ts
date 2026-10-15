import { summarizeClientHistory } from "../../client-history.js";

/**
 * `/historial_cliente`: cuantos tickets ha abierto alguien y como acabaron.
 *
 * Lo que se lleva del nucleo no es el recuento —eso ya vivia aqui— sino **la
 * traduccion del estado guardado a las tres categorias que se enseñan**, que
 * estaba dentro del `case` como un objeto suelto.
 */

/**
 * Como se traduce el estado de un ticket a lo que se cuenta.
 *
 * `assigned` cuenta como ABIERTO y eso no es evidente: asignarle un ticket a
 * alguien no lo resuelve, solo le pone dueño. Contarlo como cerrado haria que
 * un equipo con mucho trabajo repartido pareciera un equipo al dia.
 *
 * Un estado que no este aqui cuenta como abierto, que es el lado prudente: es
 * mejor que un ticket desconocido aparezca como pendiente y alguien lo mire, a
 * que desaparezca del recuento.
 */
const CATEGORIA_POR_ESTADO: Record<string, "abierto" | "resuelto" | "cerrado"> =
  {
    open: "abierto",
    assigned: "abierto",
    closed: "cerrado",
  };

/** El estado de un ticket, tal como lo guarda la base. */
export interface TicketDelCliente {
  readonly estado: string;
}

export const informeDeHistorialDeCliente = (
  tickets: readonly TicketDelCliente[],
): string => {
  const resumen = summarizeClientHistory(
    tickets.map((t) => ({
      status: CATEGORIA_POR_ESTADO[t.estado] ?? "abierto",
    })),
  );

  return `🎫 Total: ${resumen.total} · Abiertos: ${resumen.open} · Resueltos: ${resumen.resolved} · Cerrados: ${resumen.closed}`;
};
