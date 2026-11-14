import { run } from 'node:test';
import { spec } from 'node:test/reporters';
import fs from 'node:fs';
import path from 'node:path';

function findTestFiles(dir: string): string[] {
  const results: string[] = [];
  if (!fs.existsSync(dir)) return results;

  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...findTestFiles(fullPath));
    } else if (entry.isFile() && entry.name.endsWith('.test.ts')) {
      results.push(fullPath);
    }
  }
  return results;
}

async function main() {
  const testsDir = path.resolve('tests', 'e2e');
  const testFiles = findTestFiles(testsDir);

  console.log(`\n======================================================`);
  console.log(` Nexus Finance E2E Verification Suite (Tiers 1-4)`);
  console.log(`======================================================`);
  console.log(`Discovered ${testFiles.length} test suite files across all 4 tiers:\n`);

  const tiers: Record<string, string[]> = {
    'Tier 1: Feature Coverage': [],
    'Tier 2: Boundary & Corner Cases': [],
    'Tier 3: Cross-Feature Combinations': [],
    'Tier 4: Real-World Scenarios': []
  };

  for (const f of testFiles) {
    const rel = path.relative('tests', f).replace(/\\/g, '/');
    if (rel.includes('tier1')) tiers['Tier 1: Feature Coverage'].push(rel);
    else if (rel.includes('tier2')) tiers['Tier 2: Boundary & Corner Cases'].push(rel);
    else if (rel.includes('tier3')) tiers['Tier 3: Cross-Feature Combinations'].push(rel);
    else if (rel.includes('tier4')) tiers['Tier 4: Real-World Scenarios'].push(rel);
  }

  for (const [tier, files] of Object.entries(tiers)) {
    console.log(`\x1b[1m\x1b[34m[${tier}]\x1b[0m (${files.length} suites)`);
    for (const file of files) {
      console.log(`  - ${file}`);
    }
    console.log('');
  }

  console.log(`Executing test runner...\n`);

  let failed = false;
  const testStream = run({
    files: testFiles,
    concurrency: 1
  });

  testStream.on('test:fail', () => {
    failed = true;
  });

  testStream.compose(new spec()).pipe(process.stdout);

  testStream.on('end', () => {
    console.log(`\n======================================================`);
    if (failed) {
      console.log(`\x1b[31m[TEST SUITE RUN: FAILED]\x1b[0m Some tests failed.`);
      process.exit(1);
    } else {
      console.log(`\x1b[32m[TEST SUITE RUN: 100% PASSED]\x1b[0m All tests passed.`);
      process.exit(0);
    }
  });
}

main().catch(err => {
  console.error('Fatal error running tests:', err);
  process.exit(1);
});
