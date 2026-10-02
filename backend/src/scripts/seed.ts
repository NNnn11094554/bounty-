/**
 * Заполнить справочники игры из конфигов: npm run db:seed
 *   по умолчанию — только добавить недостающее (правки из админки сохраняются);
 *   --force — перезаписать карточки значениями из backend/src/game/config/cards.ts.
 */
import { prisma } from '../lib/db.js';
import { seedCards } from '../services/cards.js';
import { seedTasks } from '../services/tasks.js';

async function main(): Promise<void> {
  const force = process.argv.includes('--force');
  const cards = await seedCards({ force });
  console.log(force ? `Cards overwritten from config: ${cards}` : `Cards added: ${cards}`);
  console.log(`Built-in tasks added: ${await seedTasks()}`);
}

main()
  .catch((err: unknown) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
