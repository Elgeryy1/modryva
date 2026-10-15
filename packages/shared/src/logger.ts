import pino, { type DestinationStream, type LoggerOptions } from "pino";

/**
 * `destination` existe para los tests: pino escribe por defecto al fd 1 con
 * sonic-boom, saltándose cualquier intercepción de `process.stdout.write`, así
 * que la única forma de afirmar sobre el JSON emitido es inyectar el destino.
 */
export const createLogger = (
  name: string,
  level: LoggerOptions["level"] = "info",
  destination?: DestinationStream,
) => {
  const options: LoggerOptions = {
    name,
    level,
    // pino solo serializa Error bajo la clave `err`; con `{ error }` — que es
    // como loguean el consultor y los pollers — salía `"error":{}` y el único
    // fallo en tres días de log quedaba ilegible. Las dos claves pasan por el
    // mismo serializador para que dé igual cuál se use.
    serializers: {
      err: pino.stdSerializers.err,
      error: pino.stdSerializers.err,
    },
    redact: {
      paths: [
        "req.headers.authorization",
        "req.headers.x-telegram-bot-api-secret-token",
        "telegrams.secretToken",
        "token",
        "*.token",
        "*.secret",
      ],
      remove: true,
    },
  };
  return destination ? pino(options, destination) : pino(options);
};
