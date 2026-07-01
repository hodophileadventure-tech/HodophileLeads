require('ts-node/register/transpile-only');
require('dotenv').config();

const { generateQuotationNumber } = require('../src/services/quotation-number-service');

const parseCount = (value, fallback) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
};

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL is required to run the concurrency smoke test.');
    process.exitCode = 1;
    return;
  }

  const count = parseCount(process.env.CONCURRENCY_COUNT, 20);
  const referenceDate = process.env.CONCURRENCY_TEST_DATE
    ? new Date(process.env.CONCURRENCY_TEST_DATE)
    : new Date('2099-01-15T00:00:00.000Z');

  if (Number.isNaN(referenceDate.getTime())) {
    console.error('Invalid CONCURRENCY_TEST_DATE provided.');
    process.exitCode = 1;
    return;
  }

  console.log(`Running concurrency smoke test with ${count} parallel requests for ${referenceDate.toISOString().slice(0, 10)}...`);

  const results = await Promise.all(
    Array.from({ length: count }, () => generateQuotationNumber(referenceDate))
  );

  const unique = new Set(results);
  const sorted = [...results].sort();

  console.log('Generated quotation numbers:');
  console.log(sorted.join('\n'));

  if (unique.size !== results.length) {
    console.error('Duplicate quotation numbers detected.');
    process.exitCode = 1;
    return;
  }

  console.log(`✅ All ${results.length} quotation numbers were unique.`);
}

main().catch((error) => {
  console.error('Concurrency smoke test failed:', error);
  process.exitCode = 1;
});