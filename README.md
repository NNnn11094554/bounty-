# 🐈‍⬛ Meowgul — Telegram Mini App «тапалка + карточки»

Игрок вместе с чёрным котом растит свою криптокомпанию от подворотни до небоскрёба: тапает кота,
покупает карточки с пассивным доходом, поднимается по лигам, зовёт друзей. Валюта — монеты **PAW**
с отпечатком кошачьей лапы.

> README дополняется по мере готовности фаз. Текущий статус — в [PROGRESS.md](PROGRESS.md).

## Стек

- **frontend/** — React 18, Vite, TypeScript, Tailwind CSS, Zustand, Framer Motion
- **backend/** — Node.js 20, Fastify, TypeScript, Prisma, PostgreSQL, grammY (бот)
- **shared/** — общие типы API и форматирование чисел
- Тесты: Vitest (unit + интеграционные на тестовой БД), Playwright (e2e). CI — GitHub Actions.

## Персонаж

Картинка кота лежит в `frontend/public/assets/character.png` (PNG 1254×1254) и используется как есть.
При сборке скрипт `frontend/scripts/optimize-images.mjs` делает из неё WebP 512/1024, PNG-фолбэк,
иконки и OG-картинку в `frontend/public/assets/generated/`. Если файла нет — положите `character.png`
в эту папку; до тех пор используется заглушка-круг того же размера.

## Локальный запуск

Нужны Node.js 20+ и PostgreSQL 16 (проще всего через Docker).

```bash
npm install                    # зависимости всех пакетов
npm run db:up                  # PostgreSQL в Docker (или своя БД)
cp .env.example backend/.env   # при необходимости поправьте DATABASE_URL
npm run db:migrate             # миграции
npm run dev                    # API на :3000 и фронтенд на :5173
```

Откройте http://localhost:5173. В development-режиме вне Telegram используется моковый вход (фаза 2).

## Команды

| Команда | Что делает |
|---|---|
| `npm run dev` | API + фронтенд в режиме разработки |
| `npm run build` | production-сборка обоих пакетов |
| `npm test` | все unit- и интеграционные тесты |
| `npm run test:e2e` | e2e-тесты Playwright |
| `npm run lint` / `npm run typecheck` / `npm run format` | ESLint, `tsc --noEmit`, Prettier |
| `npm run check` | всё вместе — как в CI |
