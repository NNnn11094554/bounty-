import { PrismaClient } from '@prisma/client';
import { env } from '../env.js';

export const prisma = new PrismaClient({
  log: env.isDev ? ['warn', 'error'] : ['error'],
});

export type Db = typeof prisma;
