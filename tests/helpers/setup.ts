// Global test setup: deterministic env for every test file.
process.env.JWT_SECRET = process.env.JWT_SECRET || "test_secret_that_is_long_enough_for_hs256_ok";
process.env.CRON_SECRET = process.env.CRON_SECRET || "test_cron_secret";
delete process.env.RESEND_API_KEY; // never send live email from tests
