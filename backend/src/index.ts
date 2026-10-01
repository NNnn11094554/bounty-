import { buildApp } from './app.js';
import { env } from './env.js';
import { prisma } from './lib/db.js';
import { logger } from './lib/logger.js';
import { seedCards } from './services/cards.js';
import { seedTasks } from './services/tasks.js';

async function main(): Promise<void> {
  const app = await buildApp();
  await prisma.$connect();
  // новые карточки из конфига появляются в БД автоматически после деплоя
  const added = await seedCards();
  if (added > 0) logger.info({ added }, 'cards added from config');
  const tasks = await seedTasks();
  if (tasks > 0) logger.info({ tasks }, 'built-in tasks added');

  let shuttingDown = false;
  const shutdown = async (signal: string) => {
    if (shuttingDown) return;
    shuttingDown = true;
    logger.info({ signal }, 'shutting down');
    try {
      await app.close();
      await prisma.$disconnect();
    } finally {
      process.exit(0);
    }
  };
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('unhandledRejection', (reason) => logger.error({ err: reason }, 'unhandled rejection'));
  process.on('uncaughtException', (err) => logger.error({ err }, 'uncaught exception'));

  await app.listen({ host: env.HOST, port: env.PORT });
}

main().catch((err: unknown) => {
  logger.fatal({ err }, 'failed to start');
  process.exit(1);
});
