process.env.NODE_ENV = 'test';
process.env.DATABASE_URL =
  process.env.TEST_DATABASE_URL ??
  process.env.DATABASE_URL_TEST ??
  'postgresql://meowgul:meowgul@localhost:5432/meowgul_test';
process.env.BOT_TOKEN = '1234567890:TEST_TOKEN_for_unit_tests_only';
process.env.ADMIN_TELEGRAM_IDS = '999000999';
process.env.DAILY_RESET_UTC_HOUR = '16';
