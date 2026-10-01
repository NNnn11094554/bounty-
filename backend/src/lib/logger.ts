import pino from 'pino';
import { env } from '../env.js';

const redact = ['req.headers.authorization', 'req.headers["x-telegram-bot-api-secret-token"]', '*.initData'];

export const loggerOptions: pino.LoggerOptions = {
  level: env.isTest ? 'silent' : env.LOG_LEVEL,
  redact,
  ...(env.isDev
    ? { transport: { target: 'pino-pretty', options: { colorize: true, translateTime: 'SYS:HH:MM:ss' } } }
    : {}),
};

export const logger = pino(loggerOptions);
