import pino from 'pino';

const isDev = process.env['APP_ENV'] !== 'production';
const logLevel = process.env['LOG_LEVEL'] ?? 'info';

export const logger = pino({
  level: logLevel,
  ...(isDev
    ? {
        transport: {
          target: 'pino-pretty',
          options: {
            colorize: true,
            translateTime: 'HH:MM:ss',
            ignore: 'pid,hostname',
          },
        },
      }
    : {
        formatters: {
          level: (label: string) => ({ level: label }),
        },
        timestamp: pino.stdTimeFunctions.isoTime,
      }),
});

export function createChildLogger(context: Record<string, unknown>) {
  return logger.child(context);
}
