import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const projectRoot = path.resolve('.');
const updateDir = path.join(projectRoot, 'update');
const srcDir = path.join(updateDir, 'src');

// --------------------------------------------------------------------------
// 1. Color Token Contract Challenge
// --------------------------------------------------------------------------
test('CHALLENGE: nexus-tokens.css strictly provides all required color tokens for both themes', () => {
  const tokenFilePath = path.join(srcDir, 'nexus-tokens.css');
  assert.ok(fs.existsSync(tokenFilePath), 'nexus-tokens.css must exist');

  const css = fs.readFileSync(tokenFilePath, 'utf-8');

  // Expected tokens and their values
  const expectedDarkTokens: Record<string, string> = {
    '--nx-canvas': '#0d1624',
    '--nx-surface': '#121e2e',
    '--nx-subtle': '#192a3e',
    '--nx-ink': '#f3f6fa',
    '--nx-muted': '#b3bfd0',
    '--nx-rule': '#34475d',
    '--nx-blue': '#8ab8ff',
    '--nx-button': '#0d51b2',
    '--nx-button-hover': '#093f8d',
    '--nx-green': '#69d3b0',
    '--nx-accent-soft': '#1b304b',
    '--nx-header': '#0d1624',
    '--nx-danger': '#ffaca9',
    '--nx-danger-soft': '#40262e',
    '--nx-warning': '#f3ce87',
    '--nx-warning-soft': '#3b3222',
  };

  const expectedLightTokens: Record<string, string> = {
    '--nx-canvas': '#f7f8fa',
    '--nx-surface': '#ffffff',
    '--nx-subtle': '#edf2f6',
    '--nx-ink': '#101e30',
    '--nx-muted': '#526174',
    '--nx-rule': '#dce3eb',
    '--nx-blue': '#0d51b2',
    '--nx-green': '#007b58',
    '--nx-accent-soft': '#eaf1fc',
    '--nx-header': '#ffffff',
    '--nx-danger': '#b52f38',
    '--nx-danger-soft': '#ffedef',
    '--nx-warning': '#865600',
    '--nx-warning-soft': '#fff3d9',
  };

  for (const [token, value] of Object.entries(expectedDarkTokens)) {
    const regex = new RegExp(`${token}\\s*:\\s*${value}`, 'i');
    assert.match(
      css,
      regex,
      `Expected dark theme token ${token}: ${value} to be defined in nexus-tokens.css`
    );
  }

  for (const [token, value] of Object.entries(expectedLightTokens)) {
    const regex = new RegExp(`${token}\\s*:\\s*${value}`, 'i');
    assert.match(
      css,
      regex,
      `Expected light theme token ${token}: ${value} to be defined in nexus-tokens.css`
    );
  }
});

// --------------------------------------------------------------------------
// 2. Geometry Contract Challenge (7px control, 12px card)
// --------------------------------------------------------------------------
test('CHALLENGE: Geometry tokens enforce 7px control radius and 12px card radius', () => {
  const tokenFilePath = path.join(srcDir, 'nexus-tokens.css');
  const indexCssPath = path.join(srcDir, 'index.css');

  const tokenCss = fs.readFileSync(tokenFilePath, 'utf-8');
  assert.match(tokenCss, /--nx-radius-control\s*:\s*7px/i, 'Expected --nx-radius-control: 7px');
  assert.match(tokenCss, /--nx-radius-card\s*:\s*12px/i, 'Expected --nx-radius-card: 12px');

  const indexCss = fs.readFileSync(indexCssPath, 'utf-8');
  assert.match(indexCss, /--radius-control\s*:\s*7px/i, 'Expected --radius-control: 7px in index.css');
  assert.match(indexCss, /--radius-card\s*:\s*12px/i, 'Expected --radius-card: 12px in index.css');
});

// --------------------------------------------------------------------------
// 3. Typography Contract Challenge
// --------------------------------------------------------------------------
test('CHALLENGE: index.html loads Bricolage Grotesque, Instrument Sans, and DM Sans', () => {
  const indexHtmlPath = path.join(updateDir, 'index.html');
  assert.ok(fs.existsSync(indexHtmlPath), 'index.html must exist');
  const html = fs.readFileSync(indexHtmlPath, 'utf-8');

  assert.match(html, /family=Bricolage\+Grotesque/i, 'Expected Bricolage Grotesque in index.html');
  assert.match(html, /family=Instrument\+Sans/i, 'Expected Instrument Sans in index.html');
  assert.match(html, /family=DM\+Sans/i, 'Expected DM Sans in index.html');
});

test('CHALLENGE: index.css @theme defines font families and semantic color bindings', () => {
  const indexCssPath = path.join(srcDir, 'index.css');
  const indexCss = fs.readFileSync(indexCssPath, 'utf-8');

  assert.match(indexCss, /--font-sans\s*:\s*[^;]*"Instrument Sans"[^;]*"DM Sans"/s, 'Expected --font-sans to include Instrument Sans and DM Sans');
  assert.match(indexCss, /--font-heading\s*:\s*[^;]*"Bricolage Grotesque"/s, 'Expected --font-heading to include Bricolage Grotesque');
  assert.match(indexCss, /--color-action\s*:\s*var\(--nx-button\)/i, 'Expected --color-action mapping to --nx-button');
  assert.match(indexCss, /--color-action-hover\s*:\s*var\(--nx-button-hover\)/i, 'Expected --color-action-hover mapping');
  assert.match(indexCss, /--color-success\s*:\s*var\(--nx-green\)/i, 'Expected --color-success mapping to --nx-green');
});

// --------------------------------------------------------------------------
// 4. Motion Easing Challenge
// --------------------------------------------------------------------------
test('CHALLENGE: Motion easing curve --nx-ease strictly equals cubic-bezier(0.22, 1, 0.36, 1)', () => {
  const tokenFilePath = path.join(srcDir, 'nexus-tokens.css');
  const tokenCss = fs.readFileSync(tokenFilePath, 'utf-8');

  assert.match(
    tokenCss,
    /--nx-ease\s*:\s*cubic-bezier\(\s*0\.22\s*,\s*1\s*,\s*0\.36\s*,\s*1\s*\)/i,
    'Expected --nx-ease to be cubic-bezier(0.22, 1, 0.36, 1)'
  );
});

test('CHALLENGE: Reduced motion media query enforces accessible fallback (0.01ms)', () => {
  const systemCssPath = path.join(srcDir, 'nexus-system.css');
  const systemCss = fs.readFileSync(systemCssPath, 'utf-8');

  assert.match(systemCss, /@media\s*\(\s*prefers-reduced-motion\s*:\s*reduce\s*\)/i, 'Expected prefers-reduced-motion query');
  assert.match(systemCss, /animation-duration\s*:\s*0\.01ms/i, 'Expected 0.01ms animation duration fallback');
  assert.match(systemCss, /transition-duration\s*:\s*0\.01ms/i, 'Expected 0.01ms transition duration fallback');
});

// --------------------------------------------------------------------------
// 5. UI Primitives Export & Conformance Challenge
// --------------------------------------------------------------------------
test('CHALLENGE: src/components/ui/index.ts exports all 8 UI primitives', () => {
  const uiIndex = path.join(srcDir, 'components', 'ui', 'index.ts');
  assert.ok(fs.existsSync(uiIndex), 'src/components/ui/index.ts must exist');
  const content = fs.readFileSync(uiIndex, 'utf-8');

  const requiredExports = [
    './Button',
    './Input',
    './Badge',
    './Card',
    './Modal',
    './Drawer',
    './Skeleton',
    './Tabs',
  ];

  for (const exp of requiredExports) {
    assert.ok(content.includes(exp), `Expected index.ts to export ${exp}`);
  }
});

test('CHALLENGE: Button component conforms to 7px radius, easing, and variant styles', () => {
  const buttonPath = path.join(srcDir, 'components', 'ui', 'Button.tsx');
  const code = fs.readFileSync(buttonPath, 'utf-8');

  assert.match(code, /rounded-\[7px\]/, 'Button must enforce rounded-[7px]');
  assert.match(code, /ease:\s*\[0\.22,\s*1,\s*0\.36,\s*1\]/, 'Button must use natural easing curve [0.22, 1, 0.36, 1]');
  assert.match(code, /bg-action/, 'Primary button must use bg-action token');
  assert.match(code, /hover:bg-action-hover/, 'Primary button must use hover:bg-action-hover');
  assert.match(code, /focus-visible:outline-3/, 'Button must have 3px focus outline');
  assert.match(code, /whileHover=/, 'Button must include whileHover micro-interaction');
  assert.match(code, /whileTap=/, 'Button must include whileTap haptic feedback');
});

test('CHALLENGE: Input component conforms to 7px radius, label, and error state handling', () => {
  const inputPath = path.join(srcDir, 'components', 'ui', 'Input.tsx');
  const code = fs.readFileSync(inputPath, 'utf-8');

  assert.match(code, /rounded-\[7px\]/, 'Input must enforce rounded-[7px]');
  assert.match(code, /bg-subtle/, 'Input must use bg-subtle');
  assert.match(code, /border-rule/, 'Input must use border-rule');
  assert.match(code, /focus-visible:outline-brand/, 'Input must use outline-brand on focus');
  assert.match(code, /border-danger/, 'Input must support error border styling');
});

test('CHALLENGE: Badge component conforms to pill shape (rounded-full) and verified status colors', () => {
  const badgePath = path.join(srcDir, 'components', 'ui', 'Badge.tsx');
  const code = fs.readFileSync(badgePath, 'utf-8');

  assert.match(code, /rounded-full/, 'Badge must enforce rounded-full pill geometry');
  assert.match(code, /#007B58|#69D3B0/, 'Approved badge must use emerald green');
  assert.match(code, /#865600|#F3CE87/, 'Pending badge must use amber warning color');
  assert.match(code, /#B52F38|#FFACA9/, 'Rejected badge must use red danger color');
  assert.match(code, /CheckCircle/, 'Badge must integrate CheckCircle icon for approved');
  assert.match(code, /Clock/, 'Badge must integrate Clock icon for pending');
  assert.match(code, /XCircle/, 'Badge must integrate XCircle icon for rejected');
});

test('CHALLENGE: Card component conforms to 12px radius, motion easing, and surface styling', () => {
  const cardPath = path.join(srcDir, 'components', 'ui', 'Card.tsx');
  const code = fs.readFileSync(cardPath, 'utf-8');

  assert.match(code, /rounded-\[12px\]/, 'Card must enforce rounded-[12px]');
  assert.match(code, /bg-surface/, 'Card must use bg-surface');
  assert.match(code, /border-rule/, 'Card must use border-rule');
  assert.match(code, /ease:\s*\[0\.22,\s*1,\s*0\.36,\s*1\]/, 'Interactive card must use [0.22, 1, 0.36, 1]');
});

test('CHALLENGE: Modal component conforms to dialog accessibility, 12px radius, and backdrop blur', () => {
  const modalPath = path.join(srcDir, 'components', 'ui', 'Modal.tsx');
  const code = fs.readFileSync(modalPath, 'utf-8');

  assert.match(code, /role="dialog"/, 'Modal must have role="dialog"');
  assert.match(code, /aria-modal="true"/, 'Modal must have aria-modal="true"');
  assert.match(code, /rounded-\[12px\]/, 'Modal panel must have rounded-[12px]');
  assert.match(code, /backdrop-blur/, 'Modal backdrop must use backdrop-blur');
  assert.match(code, /useDialogFocus/, 'Modal must use useDialogFocus for keyboard trapping and ESC dismiss');
  assert.match(code, /ease:\s*\[0\.22,\s*1,\s*0\.36,\s*1\]/, 'Modal must use natural easing');
});

test('CHALLENGE: Drawer component conforms to slide-in motion, easing, and drawer positions', () => {
  const drawerPath = path.join(srcDir, 'components', 'ui', 'Drawer.tsx');
  const code = fs.readFileSync(drawerPath, 'utf-8');

  assert.match(code, /role="dialog"/, 'Drawer must have role="dialog"');
  assert.match(code, /ease:\s*\[0\.22,\s*1,\s*0\.36,\s*1\]/, 'Drawer must use natural easing');
  assert.match(code, /useDialogFocus/, 'Drawer must use useDialogFocus');
  assert.match(code, /right/, 'Drawer must support right position');
  assert.match(code, /bottom/, 'Drawer must support bottom position');
});

test('CHALLENGE: Skeleton component conforms to pulse animation and geometry variants', () => {
  const skeletonPath = path.join(srcDir, 'components', 'ui', 'Skeleton.tsx');
  const code = fs.readFileSync(skeletonPath, 'utf-8');

  assert.match(code, /animate-pulse/, 'Skeleton must use animate-pulse');
  assert.match(code, /bg-subtle/, 'Skeleton must use bg-subtle');
  assert.match(code, /rounded-\[4px\]/, 'Text skeleton must use rounded-[4px]');
  assert.match(code, /rounded-full/, 'Circular skeleton must use rounded-full');
  assert.match(code, /rounded-\[7px\]/, 'Rectangular skeleton must use rounded-[7px]');
  assert.match(code, /aria-hidden="true"/, 'Skeleton must be hidden from screen readers');
});

test('CHALLENGE: Tabs component conforms to layoutId animated indicator and easing', () => {
  const tabsPath = path.join(srcDir, 'components', 'ui', 'Tabs.tsx');
  const code = fs.readFileSync(tabsPath, 'utf-8');

  assert.match(code, /layoutId="activeTabUnderline"/, 'Tabs must use motion layoutId for active indicator');
  assert.match(code, /ease:\s*\[0\.22,\s*1,\s*0\.36,\s*1\]/, 'Tabs must use natural easing');
  assert.match(code, /bg-brand/, 'Active tab indicator must use bg-brand');
  assert.match(code, /onClick=\{\s*\(\)\s*=>\s*onChange\(\s*tab\.id\s*\)\s*\}/, 'Tabs must trigger onChange with tab id');
});

// --------------------------------------------------------------------------
// 6. Production Compilation and Bundle Verification
// --------------------------------------------------------------------------
test('CHALLENGE: Production distribution bundle dist/ exists and contains compiled CSS/JS', () => {
  const distDir = path.join(updateDir, 'dist');
  assert.ok(fs.existsSync(distDir), 'update/dist must exist from build');
  assert.ok(fs.existsSync(path.join(distDir, 'index.html')), 'dist/index.html must exist');

  const assetsDir = path.join(distDir, 'assets');
  assert.ok(fs.existsSync(assetsDir), 'dist/assets must exist');

  const assets = fs.readdirSync(assetsDir);
  const cssFile = assets.find((a) => a.endsWith('.css'));
  const jsFile = assets.find((a) => a.endsWith('.js'));

  assert.ok(cssFile, 'Production CSS asset must exist in dist/assets');
  assert.ok(jsFile, 'Production JS asset must exist in dist/assets');

  // Verify compiled CSS includes critical token rules
  const compiledCss = fs.readFileSync(path.join(assetsDir, cssFile!), 'utf-8');
  assert.match(compiledCss, /#0d51b2/i, 'Compiled CSS must include sapphire #0d51b2');
  assert.match(compiledCss, /0?\.22,\s*1,\s*0?\.36,\s*1/, 'Compiled CSS must include motion easing curve');
  assert.match(compiledCss, /Bricolage Grotesque/i, 'Compiled CSS must reference Bricolage Grotesque');
});
