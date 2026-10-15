import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

/**
 * El nucleo solo puede encoger.
 *
 * `bot-update.service.ts` tiene 28.066 lineas y el plan es repartirlas entre
 * los modulos. Eso son 183 extracciones y **meses**: durante todo ese tiempo el
 * fichero esta abierto a que alguien anada un handler nuevo dentro, que es
 * exactamente como llego a 28.000.
 *
 * Este trinquete lo convierte en una calle de un solo sentido. No impide tocar
 * el fichero —hay que tocarlo constantemente— solo impide que **crezca**.
 *
 * ## Como bajar el tope
 *
 * Al extraer un handler, baja `TOPE` al numero nuevo en el mismo commit. Es a
 * mano y a proposito: obliga a mirar cuanto se ha movido de verdad, y el
 * numero en el diff cuenta la historia del reparto commit a commit.
 *
 * ## Si necesitas subirlo
 *
 * Entonces estas anadiendo comportamiento al nucleo, y la pregunta es por que
 * no va a un modulo. Puede haber una respuesta buena —traduccion, composicion
 * entre modulos: ver "Dos handlers que NO se extraen" en `CLAUDE.md`— pero
 * tiene que ser una decision, no un descuido. Subelo con su motivo escrito.
 */

/**
 * El maximo de lineas. **Solo baja.**
 *
 * Historia: 28.087 al empezar a medir → 28.066 con `edit-guard.ambient` y
 * `scheduled-strict.ambient` → 28.064 con `quarantine.ambient` → 28.048 con
 * `content-lock.ambient` → **28076, que SUBE**.
 *
 * ## Sube tambien al anadir una funcion nueva
 *
 * Robar fichas (`victimSellableChips`) son 41 lineas de comportamiento que el
 * propietario pidio: leer las fichas cambiables de la victima y pagar el botin
 * de dos sitios. No es un handler que debiera estar en un modulo — la decision
 * SI se fue a `modules/games`; lo que queda aqui es el cableado de los dos
 * movimientos, que es justo lo que al nucleo le toca.
 *
 * ## Por que subio la primera vez
 *
 * No es un handler nuevo: son dos arreglos de correccion que necesitan mas
 * lineas de las que quitan, y los dos vienen de las auditorias en paralelo.
 *
 * - **La clave de idempotencia del aviso** (`bf7e3af`). Un `/warn`
 *   reprocesado tres veces podia acabar en expulsion automatica.
 * - **El switch exhaustivo de vender fichas** (`6dc5c8a`). Sustituye un
 *   ternario binario que afirmaba "No tienes tantas" para tres de los cuatro
 *   motivos. Cuatro casos con nombre mas la red de `never` ocupan mas que un
 *   ternario, y esa es justamente la mejora.
 * - **La guarda de permisos de los 25 informes de staff**. Eran ~770 lineas
 *   con cero comprobaciones, y desde un DM se podian leer las apelaciones
 *   privadas del despliegue entero. La guarda mas el conjunto de 25 nombres
 *   que filtra ocupan 70 lineas.
 *
 * Se recorto lo que si sobraba —el comentario de `applyWarn` repetia lo que ya
 * explica `CreateWarningInput.claveIdempotencia`— y el resto se sube a
 * proposito. El trinquete existe para que anadir comportamiento al nucleo pida
 * una decision escrita, no para bloquear un arreglo de seguridad.
 *
 * **Subida del 2026-08-25: +160 por `/setmonedas`.**
 *
 * La pregunta que obliga a hacerse el trinquete es por que esto no va a un
 * modulo. Respuesta: porque lo que ocupa NO es la decision, es la puerta.
 *
 * La decision de `/setmonedas` cabe en una linea —el saldo que queda es el
 * numero que te han dado—. Las otras ciento cincuenta y nueve son la guarda de
 * owner, la resolucion del id, el tope del entero de 32 bits, la clave
 * determinista y la auditoria. Eso es exactamente lo que el nucleo se queda
 * cuando se extrae un handler: traduccion y permisos. Un modulo con esto
 * dentro tendria que saber quien es owner y como se audita, que son las dos
 * cosas que los modulos no pueden saber.
 *
 * Lo que si podria bajar algun dia es el parseo, junto con el de
 * `/ajustarsaldo`, que es su hermano y repite la mitad. Anotado, no hecho:
 * mezclarlo con un arreglo de dinero es como se cuelan los errores.
 *
 * **Subida del 2026-08-25: +92 por `/purga off`.**
 *
 * Misma respuesta y por el mismo motivo: la decision —cerrar— es una linea, y
 * lo que ocupa es cerrar el marcador antes de borrar el estado, que es
 * traduccion a Telegram y no cabe en un modulo. La regla de "el worker es el
 * unico que programa la siguiente" se queda escrita aqui porque es aqui donde
 * se puede romper.
 *
 * **Subida del 2026-08-26: +90 por la lista de intocables.**
 *
 * La decision SI se fue a un modulo: `esIntocable` y `textoIntocable` viven en
 * `modules/security/src/intocables.ts` y son cuatro lineas de codigo. Lo que
 * se queda aqui son los tres enganches, que es justo lo que al nucleo le toca
 * —saber DONDE se sanciona— y lo unico que un modulo no puede saber:
 *
 * - `applyTelegramEnforcement`, embudo unico de ban/mute/kick (10 llamadas);
 * - `applyWarn`, embudo de los avisos, y la unica red de los automaticos:
 *   la guarda de objetivo protegido solo esta en el camino del comando a mano;
 * - la cabecera de `handleJoinRequest`, que cubre de una vez fedban, CAS,
 *   grupo requerido y Guardian — colgarlo solo de Guardian dejaba tres
 *   puertas mas por las que echar a la misma persona.
 *
 * Lo demas es la negativa honesta en `bloqueoPorObjetivoProtegido` (antes
 * `...Admin`, renombrado porque ya son dos motivos) con su auditoria. Ese
 * bloque ocupa porque NO se calla: un `/ban` que contesta "hecho" sin banear
 * es la misma mentira que el "Aprobado" de Guardian sobre una solicitud
 * caducada.
 *
 * **Subida del 2026-08-26: +24 por instrumentar el DM de Guardian.**
 *
 * No es comportamiento nuevo: el reparto de milisegundos ya se calculaba, pero
 * solo dentro del `catch` del boton nativo, asi que cuando lo que fallaba era
 * el DM se anotaba el 403 pelado y sin una sola cifra. Sacarlo a
 * `repartoDeMilisegundos` y llamarlo tambien desde el otro `catch` cuesta
 * estas lineas, y es lo que permite distinguir las dos unicas causas del 403 —
 * update tardio, o ventana cerrada por nuestra propia respuesta al `query_id`—
 * que piden arreglos opuestos.
 *
 * Ocupa lo que ocupa porque el comentario explica que significa cada numero.
 * Un diagnostico que hay que descifrar no se usa.
 *
 * **Subida del 2026-08-27: +22 por el orden del DM de Guardian.**
 *
 * El cambio de codigo son DOS lineas —`Promise.all` pasa a dos `await`
 * seguidos, el DM delante— y todo lo demas es el comentario que dice por que.
 * Se sube entero a proposito: sin el, esas dos lineas parecen una
 * desoptimizacion evidente y el primero que pase las vuelve a paralelizar.
 *
 * Lo que explica no se deduce del codigo: que `sendChatJoinRequestWebApp`
 * PROCESA la solicitud (palabra de la documentacion de Telegram) y que
 * `user_chat_id` solo vale HASTA que se procesa, asi que responder al
 * `query_id` mata el permiso del DM. Van las dos frases citadas literales
 * porque son la prueba, y 19 de 19 fallos medidos porque son la confirmacion.
 *
 * (Ojo: la CAUSA de esta entrada resulto ser falsa. Ver la siguiente.)
 *
 * **Subida del 2026-08-27 (segunda): +6 al corregir la explicacion del DM.**
 *
 * La subida anterior daba por causa que responder al `query_id` cerraba la
 * ventana del DM. La prueba en vivo de las 14:26:39 —cuenta nueva, retraso de
 * entrega cero, DM a los 117 ms y ANTES de responder— devolvio el mismo 403.
 * Era falsa. El comentario ahora dice las dos cosas: por que el orden es el
 * correcto igualmente (lo dice la documentacion) y por que NO arregla nada.
 *
 * Se paga porque un comentario que afirma una causa desmentida es peor que no
 * tener comentario: manda al siguiente a repetir el experimento.
 *
 * **Subida del 2026-08-27 (tercera): +100 por el auto-rescate de Guardian.**
 *
 * Es comportamiento nuevo y pedido: quien se queda sin Mini App no tenia
 * NINGUNA salida propia. El boton nativo lo escribe Telegram y a veces no
 * aparece; el DM explicativo le falla con 403 porque nunca abrio chat con el
 * bot; y `user_chat_id`, que existe justo para eso, no lo concede en este
 * flujo. Dependia de que un admin se enterara y le pasara un `/reenviar`.
 *
 * La pregunta del trinquete —por que no va a un modulo— tiene la respuesta de
 * siempre: la DECISION si se fue (`esArranqueDeAutoVerificacion`, en
 * `modules/guardian`, tres lineas). Lo que se queda aqui es rotar el token,
 * respetar el cerrojo optimista y redactar el mensaje, o sea persistencia,
 * concurrencia y Telegram: las tres cosas que un modulo no puede tocar.
 *
 * Y la mitad son el texto. Es el unico sitio del sistema donde cabe explicar
 * POR QUE se pide una foto — el 42% que nunca abre la Mini App no ha llegado
 * a leer esa explicacion jamas. Recortarlo para que quepa en el tope seria
 * quitar justo lo que hace que el rescate sirva.
 *
 * **Subida del 2026-08-28: +71 por los comandos de mascotas.**
 *
 * **Subida del 2026-09-03: +159 por `/ayudante`.**
 *
 * Mete la cuenta del Ayudante en un grupo sin que nadie toque nada. Lo que
 * sube son las dos firmas de handler y la FABRICA de dependencias
 * (`dependenciasDeAyudante`): el token, el propietario y donde se anota el
 * ajuste son justo lo que un fichero de fuera no puede saber, asi que se
 * construyen aqui y se pasan hechas.
 *
 * La decision y la orquestacion ya viven fuera, en
 * `nucleo/vincular-ayudante.ts` y `nucleo/mandos-de-ayudante.ts`, con sus 29
 * tests. Sin esa separacion esto habrian sido +400.
 *
 * El plan (`docs/PLAN-MASCOTAS.md`) decia pagarlo por delante extrayendo
 * `handleUtilityPlusCommand`. No se ha hecho, y el motivo es que **mezclar las
 * dos cosas en el mismo commit produce un diff que nadie puede revisar**: una
 * extraccion de mil lineas y una feature nueva a la vez, y si algo se rompe no
 * hay forma de saber cual de las dos fue. La extraccion sigue pendiente y se
 * hace sola, en su commit, con su verificacion.
 *
 * La pregunta del trinquete —por que no va a un modulo— tiene aqui la
 * respuesta mas limpia de las ocho subidas: **es que ya se fue todo**. Los
 * cinco comandos, la decision, el texto, las barras y las caras estan en
 * `modules/games/src/pets/bot/mascotas.ts`, y hasta el adaptador vive fuera,
 * en `apps/bot/src/nucleo/adaptador-mascotas.ts`. Lo que queda son 71 lineas de
 * traduccion pura: comprobar que el comando es suyo, leer los ajustes del
 * grupo, construir el adaptador, resolver a quien se responde —con
 * `extractReplyContext`, que vive en otro modulo y por eso lo llama el nucleo—
 * y llamar. Ni un `if` que decida nada.
 *
 * Es exactamente el caso que este mismo comentario admite como respuesta
 * buena: traduccion. Recortarlo mas significaria meter en el modulo o la forma
 * de un update de Telegram o el acceso a `chat_settings`, y las dos cosas son
 * justo lo que un modulo no debe saber.
 *
 * **Subida del 2026-08-28 (segunda): +31 por el boton de la Mini App.**
 *
 * Es la puerta: sin el, la unica forma de abrir la pantalla de mascotas era
 * pegar el enlace a mano. Las treinta lineas son el boton y la comprobacion de
 * que hay grupo y nombre de bot — traduccion, sin una decision dentro.
 *
 * Y aqui va escrita una deuda, para que no se pierda: **la extraccion de
 * `handleUtilityPlusCommand` sigue pendiente**. Son 466 lineas (23872-24337) y
 * pagarian de sobra las dos subidas de mascotas. No se ha hecho porque una
 * extraccion de ese tamaño necesita su propio cambio y su propia verificacion:
 * mezclarla con una feature deja un diff que nadie puede revisar, y este
 * fichero es el bot que modera un grupo de 230 personas.
 *
 * **Subida del 2026-08-28 (tercera): +19 por los nombres del corral.**
 *
 * El corral salio a produccion enseñando ids: "Gato — nivel 1 · 9000000008".
 * Nadie se reconoce en un numero, y este mismo fichero ya lo tenia escrito
 * para el ranking de /ricos. Son veinte lineas de resolver nombres en bloque,
 * y van aqui porque quien sabe traducir un id de Telegram a un nombre es el
 * repositorio de la fundacion, que un modulo no puede tocar.
 *
 * Solo se piden cuando hacen falta: /alimentar y /huevo no leen ningun nombre
 * y no pagan la consulta.
 *
 * **Subida del 2026-08-28 (cuarta): +20 por sancionar a administradores.**
 *
 * Es la subida mas barata de las once, y lo es porque llega con dos borrados:
 * `sancionaAUnAdmin` (40 lineas con sus comentarios) se ha ido entera, y con
 * ella el ultimo consumidor de `buildProtectedTargetReply`. El bruto fueron
 * ~60 lineas; el neto, 20.
 *
 * Antes un administrador era simplemente insancionable. No era pereza: un
 * `/mute` a un admin nombrado por el bot lo DEGRADA en silencio, y paso de
 * verdad el 6 de agosto de 2026 en Grupo Central con tres de ellos. La negativa
 * era lo unico seguro que se podia hacer. El precio lo pagaban 37 intentos
 * bloqueados en el registro, todos de admins intentando moderarse entre ellos.
 *
 * Lo que cambia es que ahora se pregunta `can_be_edited`, que parte a los
 * administradores en dos casos que no se parecen: al que nombro el bot se le
 * guarda el cargo antes de restringirle y se le devuelve al levantar la
 * sancion; al que nombro una persona **no se le puede tocar y punto**, porque
 * Telegram rechaza la llamada, y lo unico honrado es decirlo.
 *
 * La pregunta del trinquete —por que no va a un modulo— tiene las dos mitades
 * fuera ya. La DECISION es pura y vive en
 * `modules/security/src/sanciones-a-admins.ts`: quien puede, quien no, y si
 * hay cargo que guardar. La ORQUESTACION —las dos llamadas a la Bot API y la
 * traduccion entre lo que devuelve una y lo que pide la otra— vive en
 * `apps/bot/src/nucleo/cargos-de-admin.ts`, fuera de este fichero a proposito.
 *
 * Las 20 que se quedan son las tres que no pueden salir: pasarle el cargo al
 * repositorio al crear la sancion, leerlo ANTES de revertirla —despues ya no
 * hay sancion viva donde mirar— y devolverlo despues de levantar la
 * restriccion. Persistencia y orden de efectos, o sea las dos cosas que un
 * modulo no puede decidir.
 *
 * **Subida del 2026-08-29: +21 por los juguetes de la tienda.**
 *
 * Comportamiento nuevo y pedido: el animo SOLO bajaba —24 al dia— y jugar
 * gratis devuelve 15, asi que sin algo mas la barra siempre caia. Los juguetes
 * son ese algo, y ademas son un sumidero, que es lo que la economia necesita.
 *
 * La pregunta del trinquete tiene las dos mitades fuera. La DECISION es pura y
 * vive en `modules/games/src/pets/juguetes.ts`: cuanto sube cada juguete, si
 * cabe en la barra y si queda cupo hoy. La ORQUESTACION —leer la fila,
 * envejecerla, escribir— vive en `apps/bot/src/nucleo/juguetes.ts`.
 *
 * Las 21 que quedan aqui son la traduccion que no puede salir: reconocer que
 * el id que se acaba de comprar es un juguete, llamar, y decidir entre
 * contestar o DEVOLVER el dinero. Esa ultima decision es del nucleo porque el
 * cobro es suyo: quien cobra es quien tiene que saber deshacerlo.
 *
 * **Subida del 2026-08-29 (segunda): +3 por el texto de `/nombrar`.**
 *
 * Tres lineas, y dos son el comentario. Lo unico que hace el nucleo es pasarle
 * al modulo lo que se escribio detras del comando, **en bruto y sin mirarlo**:
 * quien decide que es un nombre valido —el largo, los caracteres que romperian
 * el HTML, el arroba que parece una mencion— es
 * `modules/games/src/pets/nombrar.ts`, pegado a lo que compone ese HTML.
 *
 * Validar aqui habria sido mas corto de escribir y peor: la regla viviria
 * lejos del sitio donde se rompe.
 *
 * **Subida del 2026-09-02: +14 por las mascotas dentro de `/robar`.**
 *
 * Es composicion entre sistemas, que es de los pocos motivos buenos para
 * crecer: el robo mira los bichos de las DOS partes —el zorro de quien ataca y
 * la tortuga de quien lo sufre— y los fusiona con los objetos de la tienda.
 * Ninguno de los dos modulos puede hacer eso por si solo sin importar al otro,
 * y los modulos no se importan entre ellos.
 *
 * De las 14, ir a buscar las dos mascotas y traducir lo que aportan **no esta
 * aqui**: vive en `apps/bot/src/nucleo/mascotas-en-el-robo.ts`. Lo que queda
 * es la llamada y el comentario que explica por que se fusiona en vez de
 * elegir uno.
 *
 * **Subida del 2026-09-02 (segunda): +12 por el cerdito y la caja fuerte.**
 *
 * Mismo caso que el anterior y por eso va aparte en vez de sumarse: el tope de
 * la caja lo decide la TIENDA (lo comprado con `/comprar caja`) y la excepcion
 * del entorno, y ahora tambien la mascota. Los tres se combinan donde se
 * combinan hoy, que es aqui.
 *
 * El extra del bicho se suma a lo COMPRADO y no al tope final: asi sigue
 * respetando la caja sin tope y comprar mas caja sigue sumando encima. Esa
 * eleccion es una linea y es la unica decision del bloque.
 *
 * **Subida del 2026-09-02 (tercera): +10 por el perro y `/gracias`.**
 *
 * Ocho de llamada y dos de comentario. Todo lo demas —leer la mascota de quien
 * RECIBE las gracias, envejecerla, mirar si su especie tiene ese efecto y
 * guardar— vive en `apps/bot/src/nucleo/animo-por-gratitud.ts`.
 *
 * Es composicion entre sistemas otra vez: la gratitud vive en un modulo y las
 * mascotas en otro, y los modulos no se importan entre ellos.
 *
 * **Subida del 2026-09-02 (cuarta): +26 por la serpiente y el objeto salvado.**
 *
 * `ahorraObjeto` no podia ir dentro de `resolveSteal`: el motor decide el robo
 * y **no toca inventarios** a proposito, asi que devolver el objeto al cajon
 * solo puede hacerlo quien tiene el cajon. La DECISION —si le toca salvarlo,
 * con la tirada ya sorteada por parametro— vive fuera, en
 * `nucleo/mascotas-en-el-robo.ts`; aqui esta el `if` y la devolucion.
 *
 * **Subida del 2026-09-02 (quinta): +24 por el caracol y el mapache.**
 *
 * Los dos ocurren DESPUES de un robo con exito y ninguno cabe en
 * `resolveSteal`: uno apunta una deuda que se paga dias mas tarde y el otro
 * mueve objetos entre inventarios, y el motor no toca ni la base de datos ni
 * el cajon. Todo eso vive en `nucleo/tras-el-robo.ts`.
 *
 * De las 24 aqui, la mitad es el texto: si el bicho se lleva un objeto hay que
 * DECIRLO. Un objeto que cambia de dueño en silencio se descubre el dia que
 * alguien va a usarlo y no esta.
 *
 * `/proteger` —el castor— no suma ni una linea: entro en
 * `COMANDOS_DE_MASCOTAS`, que el nucleo ya despacha con su objetivo y su
 * texto. Es el patron a repetir cuando un comando nuevo es de un modulo que ya
 * tiene handler.
 *
 * **Subida del 2026-09-02 (sexta): +75 por `/pet`, el mando del creador.**
 *
 * Es la primera subida de esta serie que paga por un handler ENTERO y no por
 * un trozo de uno, y conviene decir por que se acepta.
 *
 * `/pet` es el mando que declara una enfermedad grave —la unica forma en que
 * una mascota puede morir— y sus dos deshaceres. No podia entrar por
 * `COMANDOS_DE_MASCOTAS`, que es el camino barato y el que uso `/proteger` sin
 * costar una linea, porque ese handler esta atado a **quien escribe**: su
 * puerto se construye con el `usuario` del update y no acepta otro, que es
 * justo la propiedad que impide que alguien lea la mascota de un tercero. Un
 * mando actua sobre OTRA persona, asi que necesita un puerto distinto y por
 * tanto un handler distinto.
 *
 * De las 75, ni una es decision. `mandos.ts` valida lo que se ha pedido,
 * `enfermedad.ts` calcula la factura y el plazo, y
 * `nucleo/mandos-de-mascotas.ts` orquesta, registra y redacta. Aqui queda leer
 * los ajustes, resolver a quien se responde, buscar su nombre y armar las ocho
 * dependencias. Ese armado ES el grueso: son datos y repositorios, y viven
 * aqui porque el nucleo es el unico que los tiene.
 *
 * `/operar` —lo que paga la operacion— no suma **ni una linea**: entro por
 * `COMANDOS_DE_MASCOTAS`, como el castor. El camino barato sigue siendo el
 * camino por defecto.
 *
 * **Subida del 2026-09-02 (septima): +18 por arreglar quien es el propietario.**
 *
 * `/pet` miraba `SUPERBOT_OWNER_TELEGRAM_ID`, que identifica al dueño de ESTA
 * instalacion. En produccion vale otra cuenta, asi que el mando le contestaba
 * "esto solo lo puede hacer el propietario del bot" **al propietario**, en el
 * grupo y delante de todos. Lo que hacia falta era "¿eres tu?", que es el id de
 * la persona.
 *
 * De las 18, catorce son el comentario de `CREADOR_TELEGRAM_ID` explicando esa
 * diferencia, porque el fallo se comete solo: las dos cosas se llaman
 * "propietario". A cambio desaparecen dos literales duplicados del mismo id —
 * `/nuke` y `/bdani` ya lo tenian escrito a mano cada uno por su lado.
 *
 * **Subida del 2026-09-02 (octava): +21 por el gato negro en el duelo.**
 *
 * Composicion entre sistemas otra vez: el duelo de dados vive en el casino y
 * las mascotas en otro modulo. La DECISION —quien gana un empate cuando hay
 * gato negro— es pura y vive en `pets/en-la-arena.ts`; aqui quedan las dos
 * lecturas y la llamada.
 *
 * Y solo puede cambiar un EMPATE. Las tiradas las hace Telegram, con su
 * animacion, asi que no se puede restar nada a un dado que la gente ha visto
 * rodar: quedarse con los empates es la unica penalizacion posible sobre un
 * resultado que no controlamos.
 *
 * **Subida del 2026-09-09: +157 por `/ilimitado`.**
 *
 * La pregunta del trinquete es por que esto no va a un modulo, y la respuesta
 * es la misma que la de `/setmonedas`: lo que ocupa NO es la decision. La
 * decision cabe en una linea —la bandera queda como te han dicho— y de hecho
 * ni siquiera esta aqui, esta en `setUnlimited`. Las otras ciento cincuenta y
 * seis son la guarda de owner, la resolucion del id, el `on|off`, el listado y
 * la auditoria: permisos y traduccion a Telegram, que son justo las dos cosas
 * que un modulo no puede saber.
 *
 * Lo que de verdad justifica la subida es lo que sustituye. La columna
 * `unlimited` existia desde esta misma manana y solo se podia tocar con SQL
 * contra produccion, escribiendo la fila de auditoria a mano y sin forma de
 * listar quien la tenia. Un privilegio asi es mas facil de encender que de
 * apagar, y eso es al reves de como tiene que ser.
 *
 * Y una que si podria bajar algun dia: el listado. `listarSaldosSinFondo` es
 * un `map` sobre filas y no necesita saber quien es owner, asi que es lo unico
 * de aqui con forma de irse. Anotado, no hecho.
 *
 * **Subida del 2026-09-12: +23 por la inmunidad al robo.**
 *
 * La decision NO esta aqui: vive en `modules/games/src/steal.ts`, que es donde
 * tiene que estar y donde la prueban sus tests. Lo que se queda aqui es
 * pasarle el dato, el "no" en español —traduccion pura— y una guarda que corta
 * ANTES de reclamar el objeto del ladron. Casi la mitad son comentario.
 *
 * Esa guarda es la unica que merece discusion, porque repite un booleano que
 * `resolveSteal` ya comprueba. Se queda por el orden del nucleo: los objetos se
 * reclaman antes de resolver, asi que sin ella cada intento contra alguien que
 * no es robable NUNCA se comia una navaja. Los demas rechazos si se la comen, y
 * esta bien, porque son esperas que pasan; este no pasa nunca.
 */
/**
 * 27.563 -> 27.545: los dos ids del creador salen a `creador.ts` y se leen del
 * entorno. Estaban escritos a mano en el nucleo.
 */
const TOPE = 27545;

describe("bot-update.service.ts solo puede encoger", () => {
  // Se cuentan saltos de linea, igual que `wc -l`. Con `split` sale uno mas,
  // porque el fichero acaba en salto y deja un elemento vacio — y entonces el
  // numero del test no cuadra con el que da la terminal, que es de donde se
  // saca al bajar el tope.
  const fuente = readFileSync(
    fileURLToPath(new URL("./bot-update.service.ts", import.meta.url)),
    "utf8",
  );
  const lineas = fuente.split("\n").length - (fuente.endsWith("\n") ? 1 : 0);

  it(`no pasa de ${TOPE} lineas`, () => {
    expect(lineas).toBeLessThanOrEqual(TOPE);
  });

  it("y si has encogido, baja el tope en el mismo commit", () => {
    // Sin esto el tope se queda viejo y deja de apretar: dentro de veinte
    // extracciones permitiria volver a crecer mil lineas sin avisar.
    expect(lineas).toBe(TOPE);
  });
});
