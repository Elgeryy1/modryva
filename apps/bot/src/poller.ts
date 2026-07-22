import type { Logger } from "@nestjs/common";
import { type RuntimeEnv, TELEGRAM_ALLOWED_UPDATES } from "@superbot/shared";
import { HttpTelegramGateway } from "@superbot/telegram";
import type { BotUpdateService } from "./bot-update.service.js";
import { readAppUrl } from "./runtime-url.js";

// Single source of truth shared with managed-bot webhook registration
// (@superbot/shared). The synthetic `managed_bot` update the poller used to list
// is dropped: Telegram never emits it, so listing it was a no-op.
const ALLOWED_UPDATES = TELEGRAM_ALLOWED_UPDATES;

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

// Minimal command list surfaced in Telegram's "/" menu. Mirrors the BotFather
// /setcommands checklist in docs/BOTFATHER.md — keep both in sync.
const BOT_COMMANDS = [
  { command: "start", description: "Iniciar Modryva" },
  { command: "help", description: "Ver ayuda" },
  { command: "settings", description: "Configurar grupo" },
  { command: "ai", description: "Preguntar a Modryva IA" },
  { command: "summarize", description: "Resumir texto" },
  { command: "translate", description: "Traducir texto" },
  { command: "aiforget", description: "Borrar memoria IA" },
  { command: "memoria", description: "Ver lo que Modryva recuerda de ti" },
  { command: "olvida", description: "Olvidar una memoria: /olvida <número>" },
  { command: "olvidatodo", description: "Borrar toda tu memoria" },
  { command: "aicode", description: "Canjear código de acceso a IA" },
  { command: "aipack", description: "Ver o cancelar el pack de IA (Stars)" },
  { command: "aistatus", description: "Estado IA owner" },
  { command: "aitest", description: "Probar IA owner" },
  { command: "reasons", description: "Motivos de sanción reutilizables" },
  { command: "tolerance", description: "Preajuste de tolerancia del grupo" },
  { command: "protejo", description: "Ver qué protege el bot ahora" },
  { command: "idgroup", description: "Ver el ID de este chat" },
  { command: "vertical", description: "Aplicar preset de vertical" },
  { command: "anuncio", description: "Analizar claridad y tono de un anuncio" },
  {
    command: "modo",
    description: "Ver los ajustes de un modo de configuración",
  },
  { command: "reglas_score", description: "Puntuar la claridad de las reglas" },
  { command: "note", description: "Añadir o ver notas internas de staff" },
  { command: "puntos", description: "Check-in diario y saldo de puntos" },
  {
    command: "receta",
    description: "Exportar o importar la configuración del grupo",
  },
  {
    command: "estado",
    description: "Página de estado e incidencias del grupo",
  },
  {
    command: "mision",
    description: "Misión cooperativa del grupo y su progreso",
  },
  {
    command: "gracias",
    description: "Dar las gracias (respondiendo) y ver tu gratitud",
  },
  { command: "topgracias", description: "Ranking de gratitud del grupo" },
  {
    command: "rango_accion",
    description: "Nivel de riesgo de una accion de moderacion",
  },
  { command: "fase_dia", description: "Rigor recomendado segun la hora" },
  { command: "horario", description: "Estado del horario de soporte" },
  { command: "permiso", description: "Comprobar permisos de un rol" },
  {
    command: "regla_natural",
    description: "Previsualizar una regla en lenguaje natural",
  },
  {
    command: "sancion_duracion",
    description: "Duracion sugerida de una sancion",
  },
  {
    command: "sancion_ajustar",
    description: "Subir o bajar un escalon de sancion",
  },
  {
    command: "proporcionalidad",
    description: "Comprobar si una sancion es proporcional",
  },
  {
    command: "confianza_decision",
    description: "Puntuar la confianza de una decision",
  },
  {
    command: "confianza",
    description: "Ver tu nivel de confianza y permisos desbloqueados",
  },
  {
    command: "novatos",
    description: "Ranking de novatos y veteranos por reputación",
  },
  {
    command: "salonfama",
    description: "Salón de la fama por valor de contribución",
  },
  {
    command: "miembros_inactivos",
    description: "Detectar miembros inactivos en la ventana reciente",
  },
  {
    command: "mapa_calor",
    description: "Mapa de calor de actividad por hora",
  },
  {
    command: "participacion",
    description: "Equilibrio de participación del grupo",
  },
  {
    command: "senal_acoso",
    description: "Detectar acoso grupal reciente hacia una persona",
  },
  {
    command: "spam_firma",
    description: "Detectar firmas de spam repetidas por usuario",
  },
  {
    command: "fantasmas",
    description: "Miembros que entraron y nunca escribieron",
  },
  {
    command: "temas_inactivos",
    description: "Temas de foro sin actividad reciente",
  },
  {
    command: "temas_emergentes",
    description: "Temas de foro que despegan o se apagan (48h)",
  },
  {
    command: "crossposting",
    description: "Mismo mensaje repetido en varios temas de foro",
  },
  {
    command: "reaccion_abuso",
    description: "Oleadas de reacciones negativas contra una persona",
  },
  {
    command: "schedulerule",
    description: "Ventanas de moderación estricta por horario (opt-in)",
  },
  {
    command: "turno",
    description: "Configurar turnos de guardia del staff (set/clear/list)",
  },
  {
    command: "ritual",
    description: "Configurar rituales semanales del grupo (add/list/remove)",
  },
  {
    command: "grupo_abandonado",
    description: "Detectar si un grupo esta abandonado",
  },
  { command: "enfado", description: "Medir el nivel de enfado de un texto" },
  { command: "vista_anuncio", description: "Previsualizar un anuncio" },
  {
    command: "prueba_antibot",
    description: "Verificar una respuesta anti-bot",
  },
  {
    command: "peticion_copia",
    description: "Detectar peticion de copiar respuestas",
  },
  {
    command: "racha_sin_sancion",
    description: "Recompensa por racha sin sanciones",
  },
  {
    command: "clasificar_apelacion",
    description: "Clasificar el tipo de apelacion",
  },
  { command: "eta_apelacion", description: "Tiempo estimado de revision" },
  {
    command: "aprendizaje_apelacion",
    description: "Aprendizaje tras cerrar una apelacion",
  },
  {
    command: "resumen_apelacion",
    description: "Resumen de apelacion para staff",
  },
  {
    command: "mediacion",
    description: "Avanzar un caso de mediacion asincrona",
  },
  { command: "checklist_ban", description: "Checklist antes de banear" },
  { command: "progreso_boss", description: "Progreso del boss semanal" },
  { command: "error_bot", description: "Evaluar un posible error del bot" },
  {
    command: "sensibilidad_caso",
    description: "Clasificar la sensibilidad de un caso",
  },
  {
    command: "acuerdo_convivencia",
    description: "Generar un acuerdo de convivencia",
  },
  {
    command: "recompensa_colectiva",
    description: "Recompensa colectiva por mejora",
  },
  {
    command: "convertir_sancion",
    description: "Convertir un mute si se acepta la regla",
  },
  {
    command: "comprar_cosmetico",
    description: "Comprobar si puedes comprar un cosmetico",
  },
  {
    command: "cupo_diario",
    description: "Comprobar el cupo diario de una mision",
  },
  { command: "calidad_datos", description: "Evaluar la calidad de los datos" },
  { command: "duelo_debate", description: "Resolver un duelo de debate" },
  {
    command: "desescalar",
    description: "Recomendacion para desescalar tension",
  },
  {
    command: "apelacion_delicada",
    description: "Marcar una apelacion como delicada",
  },
  {
    command: "ayuda_discreta",
    description: "Detectar peticion de ayuda discreta",
  },
  {
    command: "caducidad_anuncio",
    description: "Comprobar si un anuncio debe desfijarse",
  },
  {
    command: "reputacion_contenido",
    description: "Evaluar la reputacion de un contenido",
  },
  {
    command: "doble_rep",
    description: "Calcular puntos de reputacion con posible doble",
  },
  {
    command: "cooldown_dinamico",
    description: "Calcular un cooldown segun abuso",
  },
  { command: "aviso_educativo", description: "Generar un aviso educativo" },
  {
    command: "permiso_emergencia",
    description: "Conceder permisos de emergencia",
  },
  { command: "gastar_energia", description: "Comprobar gasto de energia" },
  { command: "modo_evento", description: "Reglas para un evento manual" },
  {
    command: "modo_examen",
    description: "Reglas del modo examen segun la hora",
  },
  {
    command: "razon_sancion",
    description: "Explicar el motivo de una sancion",
  },
  { command: "sancion_juego", description: "Sancion especifica de juegos" },
  {
    command: "retencion_juegos",
    description: "Retencion de jugadores vs no jugadores",
  },
  { command: "ventana_gracia", description: "Comprobar la ventana de gracia" },
  {
    command: "consejos_crecimiento",
    description: "Consejos de crecimiento del grupo",
  },
  { command: "escalar_humano", description: "Decidir si escalar a un humano" },
  {
    command: "stats_humanizadas",
    description: "Comparar estadisticas de hoy y ayer",
  },
  {
    command: "medidor_hype",
    description: "Medir el hype antes de un lanzamiento",
  },
  {
    command: "patron_imposible",
    description: "Detectar patrones imposibles en juegos",
  },
  { command: "guardia_impulsivo", description: "Frenar una accion impulsiva" },
  { command: "escalar_owner", description: "Escalar una alerta al owner" },
  {
    command: "estado_incidencia",
    description: "Avanzar el estado de una incidencia",
  },
  {
    command: "pregunta_completa",
    description: "Comprobar si una pregunta esta completa",
  },
  {
    command: "config_intencion",
    description: "Configuracion sugerida por intencion",
  },
  {
    command: "nivel_conocimiento",
    description: "Clasificar el nivel de conocimiento",
  },
  {
    command: "incidencia_conocida",
    description: "Aviso de incidencia conocida",
  },
  {
    command: "ultima_oportunidad",
    description: "Decidir la ultima oportunidad de un usuario",
  },
  {
    command: "aviso_aprendizaje",
    description: "Generar un aviso de aprendizaje",
  },
  {
    command: "items_legendarios",
    description: "Comprobar items legendarios ganados",
  },
  {
    command: "sandbox_enlace",
    description: "Comprobar el sandbox de enlaces nuevos",
  },
  {
    command: "desbloquear_enlaces",
    description: "Comprobar si se desbloquean enlaces",
  },
  {
    command: "agrupar_reportes",
    description: "Agrupar reportes por motivo similar",
  },
  {
    command: "adivina_stat",
    description: "Puntuar una adivinanza de estadistica",
  },
  {
    command: "aviso_mantenimiento",
    description: "Generar un aviso de mantenimiento",
  },
  {
    command: "relectura_obligatoria",
    description: "Comprobar si hace falta releer las normas",
  },
  { command: "carta_miembro", description: "Generar la carta de un miembro" },
  {
    command: "objetivo_miembro",
    description: "Onboarding segun el objetivo del miembro",
  },
  {
    command: "escudo_menciones",
    description: "Limitar menciones hacia un usuario",
  },
  { command: "comparar_meses", description: "Comparar metricas de dos meses" },
  {
    command: "logros_negativos",
    description: "Detectar logros negativos ocultos",
  },
  { command: "dominio_nuevo", description: "Comprobar si un dominio es nuevo" },
  {
    command: "diagnostico_observacion",
    description: "Diagnostico tras un periodo de observacion",
  },
  {
    command: "fuera_tema_estudio",
    description: "Detectar mensajes fuera de tema en horario de estudio",
  },
  {
    command: "checklist_bienvenida",
    description: "Checklist de primeros pasos",
  },
  {
    command: "sesgo_operativo",
    description: "Detectar sesgo operativo entre nuevos y veteranos",
  },
  {
    command: "exceso_config",
    description: "Avisar de exceso de configuracion",
  },
  {
    command: "owner_ausente",
    description: "Reglas cuando el owner esta ausente",
  },
  { command: "checklist_owner", description: "Checklist semanal del owner" },
  { command: "mentor_owner", description: "Consejos de mentor para el owner" },
  { command: "resumen_owner", description: "Resumen corto para el owner" },
  {
    command: "revision_entre_pares",
    description: "Comprobar si hace falta revision entre pares",
  },
  {
    command: "explicar_permiso",
    description: "Explicar un permiso de Telegram",
  },
  { command: "informe_lanzamiento", description: "Informe post-lanzamiento" },
  {
    command: "prestigio",
    description: "Comprobar si se puede ascender de prestigio",
  },
  { command: "puntuar_duda", description: "Puntuar la prioridad de una duda" },
  {
    command: "periodo_prueba",
    description: "Comprobar si sigue el periodo de prueba",
  },
  { command: "resumen_publicacion", description: "Resumen antes de publicar" },
  {
    command: "patron_cuarentena",
    description: "Comprobar el patron de cuarentena",
  },
  {
    command: "modo_solo_lectura",
    description: "Decidir si activar modo solo lectura",
  },
  { command: "cebo_respuesta", description: "Detectar cebo de respuesta" },
  { command: "revivir_silencio", description: "Reactivar un grupo silencioso" },
  {
    command: "anuncios_por_rol",
    description: "Generar variantes de anuncio por rol",
  },
  {
    command: "efecto_regla",
    description: "Efecto de una regla en la actividad",
  },
  {
    command: "cooldown_regla",
    description: "Comprobar el cooldown de una regla",
  },
  {
    command: "validar_explicacion",
    description: "Validar la explicacion de una regla",
  },
  {
    command: "severidad_regla",
    description: "Clasificar la severidad de una regla",
  },
  {
    command: "efecto_sancion",
    description: "Predecir el efecto de una sancion",
  },
  { command: "firma_sancion", description: "Generar la firma de una sancion" },
  {
    command: "modo_ahorro",
    description: "Decidir si activar el modo ahorro de IA",
  },
  { command: "logros_secretos", description: "Comprobar logros secretos" },
  {
    command: "auto_beneficio",
    description: "Detectar conflicto de auto-beneficio",
  },
  { command: "anuncio_sensible", description: "Detectar un anuncio sensible" },
  {
    command: "sensibilidad_hilo",
    description: "Clasificar la sensibilidad de un hilo",
  },
  {
    command: "color_severidad",
    description: "Semaforo de severidad por puntuacion",
  },
  {
    command: "celebracion_silenciosa",
    description: "Decidir el modo de celebracion",
  },
  { command: "spam_silencioso", description: "Detectar spam silencioso" },
  {
    command: "recomendacion_tamano",
    description: "Recomendaciones segun el tamano del grupo",
  },
  {
    command: "estabilidad_social",
    description: "Medir la estabilidad social del grupo",
  },
  {
    command: "suavizar_sancion",
    description: "Suavizar el mensaje de una sancion",
  },
  { command: "filtro_spoiler", description: "Filtrar spoilers de un texto" },
  { command: "burnout_staff", description: "Detectar burnout del staff" },
  {
    command: "confianza_staff",
    description: "Confianza del staff por acciones confirmadas",
  },
  { command: "logros_racha", description: "Logros por racha de dias" },
  {
    command: "seguimiento_ticket",
    description: "Comprobar si toca seguimiento de un ticket",
  },
  { command: "cerrar_topic", description: "Decidir si cerrar un topic" },
  {
    command: "uso_indebido_topic",
    description: "Detectar uso indebido de un topic",
  },
  {
    command: "comparar_grupos_gemelos",
    description: "Comparar metricas entre dos grupos",
  },
  {
    command: "separacion_activa",
    description: "Comprobar si sigue activa una separacion",
  },
  { command: "trato_vip", description: "Aplicar trato VIP segun el plan" },
  {
    command: "activar_proteccion_volumen",
    description: "Decidir si activar proteccion por volumen",
  },
  {
    command: "informe_apelaciones_aceptadas",
    description: "Informe de apelaciones aceptadas por regla",
  },
  {
    command: "historial_apelaciones",
    description: "Historial de apelaciones del grupo",
  },
  {
    command: "apelaciones_por_incidente",
    description: "Agrupar apelaciones por incidente",
  },
  { command: "buscar_regla", description: "Buscar en las reglas del grupo" },
  {
    command: "reglas_movil",
    description: "Version corta de las reglas para movil",
  },
  {
    command: "historial_cliente",
    description: "Historial de tickets de un cliente",
  },
  {
    command: "discusion_circular",
    description: "Detectar discusiones circulares recientes",
  },
  {
    command: "copia_pega",
    description: "Detectar mensajes copipasteados recientes",
  },
  {
    command: "spam_saludo",
    description: "Detectar patron de saludo seguido de enlace",
  },
  {
    command: "ritmo_humano",
    description: "Comprobar si el ritmo de un usuario es humano",
  },
  {
    command: "escalada_broma",
    description: "Detectar si una broma escalo a insulto",
  },
  {
    command: "tipos_conflicto",
    description: "Tipos de conflicto mas frecuentes del grupo",
  },
  {
    command: "reglas_rotas",
    description: "Ranking de normas mas rotas del grupo",
  },
  {
    command: "alias",
    description: "Gestionar alias de comandos: set|remove|list",
  },
  {
    command: "glosario",
    description: "Diccionario interno del grupo: set|remove|list",
  },
  {
    command: "voz",
    description: "Ajustar el tono del bot en el grupo",
  },
  {
    command: "nombres",
    description: "Renombrar módulos del panel: list|set|reset",
  },
  {
    command: "dock",
    description: "Accesos rápidos del panel: list|toggle|reset",
  },
  {
    command: "densidad",
    description: "Tu modo de densidad en la Mini App",
  },
  {
    command: "intereses",
    description: "Etiquetas de interés y coincidencias: add|remove|list",
  },
  {
    command: "ideas",
    description: "Votar ideas para el próximo módulo: list|add|vote|reset",
  },
  {
    command: "caza",
    description: "Caza del tesoro por pistas: estado|start|responder|reset",
  },
  {
    command: "album",
    description: "Álbum de temporada del grupo: list|add|reset",
  },
  {
    command: "rompehielo",
    description: "Pregunta rompehielos por tema",
  },
  {
    command: "acciones_revertidas",
    description: "Ranking de sanciones más revertidas",
  },
  {
    command: "tablero_casos",
    description: "Tablero kanban de casos de soporte",
  },
] as const;

interface TelegramGetUpdatesResponse {
  readonly ok: boolean;
  readonly result?: Array<{ update_id: number } & Record<string, unknown>>;
}

/**
 * Long-polling fallback for local/dev (and any deployment without a public
 * webhook URL). Pulls updates via getUpdates and feeds each one through the exact
 * same {@link BotUpdateService.processWebhook} pipeline used by the webhook, so
 * idempotency, auditing and persistence behave identically.
 */
export const startPolling = async (
  updates: BotUpdateService,
  env: RuntimeEnv,
  logger: Logger,
): Promise<void> => {
  const token = env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    logger.warn("polling disabled: TELEGRAM_BOT_TOKEN is not set");
    return;
  }

  const base = `https://api.telegram.org/bot${token}`;
  // Drop any existing webhook so getUpdates is allowed (and discard the backlog).
  try {
    await fetch(`${base}/deleteWebhook?drop_pending_updates=true`);
  } catch {
    // Non-fatal: getUpdates will report a 409 if a webhook is still set.
  }

  logger.log(`polling Telegram as @${env.TELEGRAM_BOT_USERNAME}`);

  // Point the bot's default menu button at the live Mini App URL, and re-set it
  // whenever the URL changes (the urlsync sidecar publishes the current tunnel
  // URL to /state/app_url). No restart needed — self-heals every poll tick.
  const menuGateway = new HttpTelegramGateway();
  let lastMenuUrl = "";
  const syncMenuButton = async (): Promise<void> => {
    const url = readAppUrl(env.TELEGRAM_APP_URL);
    if (!url.startsWith("https://") || url === lastMenuUrl) {
      return;
    }
    try {
      await menuGateway.setChatMenuButton({ url, text: "Panel", token });
      lastMenuUrl = url;
      logger.log(`menu button set -> ${url}`);
    } catch (error) {
      logger.warn({ error }, "failed to set chat menu button");
    }
  };
  await syncMenuButton();

  // Best-effort, once at startup: keeps Telegram's "/" command menu in sync
  // with BOT_COMMANDS without requiring a manual BotFather /setcommands step.
  // Telegram caps setMyCommands at 100 entries per scope, so only the first
  // 100 show up in the "/" autocomplete; every command still works when
  // typed out regardless of whether it made this cut.
  try {
    await menuGateway.setMyCommands({
      commands: BOT_COMMANDS.slice(0, 100),
      token,
    });
  } catch (error) {
    logger.warn({ error }, "failed to set bot commands");
  }

  let offset = 0;

  for (;;) {
    try {
      const url =
        `${base}/getUpdates?timeout=25&offset=${offset}` +
        `&allowed_updates=${encodeURIComponent(JSON.stringify(ALLOWED_UPDATES))}`;
      const response = await fetch(url);
      const data = (await response.json()) as TelegramGetUpdatesResponse;

      await syncMenuButton();

      if (!data.ok || !data.result) {
        await sleep(2000);
        continue;
      }

      for (const update of data.result) {
        offset = update.update_id + 1;
        try {
          await updates.processWebhook(env.TELEGRAM_BOT_USERNAME, update);
        } catch (error) {
          logger.error(
            { updateId: update.update_id, error },
            "failed to process polled update",
          );
        }
      }
    } catch {
      // Network blip or Telegram hiccup: back off briefly and retry.
      await sleep(2000);
    }
  }
};
