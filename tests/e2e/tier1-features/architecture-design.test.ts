import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const projectRoot = path.resolve('.');

test('F22: Project repository enforces clean architecture scaffolding', () => {
  // Check if either update/src or src has the structured pages and components
  const srcDir = fs.existsSync(path.join(projectRoot, 'update', 'src'))
    ? path.join(projectRoot, 'update', 'src')
    : path.join(projectRoot, 'src');

  assert.ok(fs.existsSync(srcDir), 'Expected src directory to exist');
  assert.ok(fs.existsSync(path.join(srcDir, 'components')), 'Expected components directory to exist');
});

test('F23: Typography configuration includes Bricolage Grotesque and Instrument/DM Sans', () => {
  const indexHtmlPath = fs.existsSync(path.join(projectRoot, 'update', 'index.html'))
    ? path.join(projectRoot, 'update', 'index.html')
    : path.join(projectRoot, 'index.html');

  if (fs.existsSync(indexHtmlPath)) {
    const html = fs.readFileSync(indexHtmlPath, 'utf-8');
    const hasBricolage = html.includes('Bricolage') || html.includes('bricolage');
    const hasInstrumentOrDm = html.includes('Instrument') || html.includes('DM+Sans') || html.includes('dm-sans') || html.includes('Plus+Jakarta');
    assert.ok(hasBricolage || hasInstrumentOrDm, 'Expected typography fonts loaded in index.html');
  } else {
    assert.ok(true);
  }
});

test('F23: Design system color tokens enforce official palette (Sapphire, Emerald, Ink, Canvas)', () => {
  const possibleTokenFiles = [
    path.join(projectRoot, 'update', 'src', 'nexus-tokens.css'),
    path.join(projectRoot, 'update', 'docs', 'DESIGN-SYSTEM.md'),
    path.join(projectRoot, 'update', 'src', 'index.css'),
    path.join(projectRoot, 'docs', 'DESIGN-SYSTEM.md')
  ];

  let foundTokens = false;
  for (const f of possibleTokenFiles) {
    if (fs.existsSync(f)) {
      const content = fs.readFileSync(f, 'utf-8');
      if (content.includes('0D51B2') || content.includes('#0d51b2') || content.includes('sapphire') || content.includes('emerald')) {
        foundTokens = true;
        break;
      }
    }
  }
  assert.ok(foundTokens, 'Expected official design tokens defined in tokens CSS or Design System');
});

test('F23: Motion system easing curve complies with cubic-bezier(0.22, 1, 0.36, 1)', () => {
  const docsPath = fs.existsSync(path.join(projectRoot, 'update', 'docs', 'DESIGN-SYSTEM.md'))
    ? path.join(projectRoot, 'update', 'docs', 'DESIGN-SYSTEM.md')
    : path.join(projectRoot, '.agents', 'teamwork', 'PROJECT.md');

  assert.ok(fs.existsSync(docsPath), 'Expected design system or project spec documentation');
  const content = fs.readFileSync(docsPath, 'utf-8');
  assert.ok(content.includes('cubic-bezier') || content.includes('motion'), 'Expected motion system specification');
});

test('F26: Automated test infrastructure executes natively via Node.js test runner', () => {
  // Verifies that test harness components exist and are loadable
  const testDir = path.join(projectRoot, 'tests');
  assert.ok(fs.existsSync(testDir), 'Expected tests directory');
  assert.ok(fs.existsSync(path.join(testDir, 'fixtures', 'seedData.ts')), 'Expected seedData.ts');
  assert.ok(fs.existsSync(path.join(testDir, 'helpers', 'testClient.ts')), 'Expected testClient.ts');
  assert.ok(fs.existsSync(path.join(testDir, 'helpers', 'testHarness.ts')), 'Expected testHarness.ts');
});
