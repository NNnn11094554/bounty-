import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import type { ApiErrorBody, HealthResponse } from '@meowgul/shared';
import Fastify, { type FastifyError, type FastifyInstance } from 'fastify';
import { ZodError } from 'zod';
import { env } from './env.js';
import { ApiError } from './lib/errors.js';
import { loggerOptions } from './lib/logger.js';
import { APP_VERSION } from './version.js';

export interface BuildAppOptions {
  logger?: boolean;
}

export async function buildApp(opts: BuildAppOptions = {}): Promise<FastifyInstance> {
  const app = Fastify({
    logger: opts.logger === false ? false : loggerOptions,
    trustProxy: true,
    bodyLimit: 64 * 1024,
    disableRequestLogging: env.isProd,
  });

  await app.register(helmet, { contentSecurityPolicy: false, crossOriginResourcePolicy: false });
  await app.register(cors, {
    origin: (origin, cb) => {
      // запросы без Origin (curl, бот, healthcheck) и разрешённые домены фронтенда
      if (!origin) return cb(null, true);
      const normalized = origin.replace(/\/$/, '');
      if (
        env.corsOrigins.includes(normalized) ||
        (env.isDev && /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(normalized))
      ) {
        return cb(null, true);
      }
      cb(null, false);
    },
    credentials: false,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Authorization', 'Content-Type', 'X-Client-Version'],
    maxAge: 86400,
  });

  app.setErrorHandler((error: FastifyError | ApiError | ZodError, request, reply) => {
    if (error instanceof ApiError) {
      const body: ApiErrorBody = {
        error: { code: error.code, message: error.message, details: error.details },
      };
      return reply.status(error.statusCode).send(body);
    }
    if (error instanceof ZodError) {
      const body: ApiErrorBody = {
        error: { code: 'VALIDATION', message: 'Invalid request', details: { issues: error.issues } },
      };
      return reply.status(400).send(body);
    }
    const status = error.statusCode ?? 500;
    if (status === 429) {
      return reply.status(429).send({ error: { code: 'RATE_LIMITED', message: 'Too many requests' } });
    }
    if (status >= 500) {
      request.log.error({ err: error }, 'unhandled error');
      return reply.status(500).send({ error: { code: 'INTERNAL', message: 'Internal server error' } });
    }
    return reply
      .status(status)
      .send({ error: { code: status === 404 ? 'NOT_FOUND' : 'VALIDATION', message: error.message } });
  });

  app.setNotFoundHandler((_request, reply) => {
    reply.status(404).send({ error: { code: 'NOT_FOUND', message: 'Route not found' } });
  });

  app.get('/health', async (): Promise<HealthResponse> => ({
    status: 'ok',
    version: APP_VERSION,
    time: new Date().toISOString(),
  }));

  return app;
}
