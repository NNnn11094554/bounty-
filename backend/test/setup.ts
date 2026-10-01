process.env.NODE_ENV = 'test';
process.env.DATABASE_URL ??= 'postgresql://meowgul:meowgul@localhost:5432/meowgul_test';
process.env.BOT_TOKEN ??= '1234567890:TEST_TOKEN_for_unit_tests_only';
