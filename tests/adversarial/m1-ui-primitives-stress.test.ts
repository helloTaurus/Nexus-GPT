import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { Button } from '../../update/src/components/ui/Button';
import { Input } from '../../update/src/components/ui/Input';
import { Badge } from '../../update/src/components/ui/Badge';
import { Card } from '../../update/src/components/ui/Card';
import { Skeleton } from '../../update/src/components/ui/Skeleton';
import { Tabs } from '../../update/src/components/ui/Tabs';
import { Modal } from '../../update/src/components/ui/Modal';
import { Drawer } from '../../update/src/components/ui/Drawer';

// ============================================================================
// STRESS TEST: Button Matrix & State Handling
// ============================================================================
test('STRESS: Button matrix of 6 variants x 3 sizes renders without regression', () => {
  const variants = ['primary', 'secondary', 'outline', 'ghost', 'danger', 'success'] as const;
  const sizes = ['sm', 'md', 'lg'] as const;

  for (const variant of variants) {
    for (const size of sizes) {
      const html = renderToStaticMarkup(
        React.createElement(Button, { variant, size }, `Action ${variant} ${size}`)
      );
      assert.ok(html.includes('rounded-[7px]'), `Button [${variant}, ${size}] missing rounded-[7px]`);
      assert.ok(html.includes(`Action ${variant} ${size}`), `Button missing label text`);

      if (variant === 'primary') {
        assert.ok(html.includes('bg-action'), `Primary button must have bg-action`);
      } else if (variant === 'danger') {
        assert.ok(html.includes('bg-danger'), `Danger button must have bg-danger`);
      } else if (variant === 'success') {
        assert.ok(html.includes('bg-success'), `Success button must have bg-success`);
      }

      if (size === 'sm') {
        assert.ok(html.includes('min-h-[36px]'), `Sm button must have min-h-[36px]`);
      } else if (size === 'md') {
        assert.ok(html.includes('min-h-[44px]'), `Md button must have min-h-[44px]`);
      } else if (size === 'lg') {
        assert.ok(html.includes('min-h-[50px]'), `Lg button must have min-h-[50px]`);
      }
    }
  }
});

test('STRESS: Button disabled and loading edge cases', () => {
  // Test disabled state
  const disabledHtml = renderToStaticMarkup(
    React.createElement(Button, { disabled: true }, 'Disabled Button')
  );
  assert.ok(disabledHtml.includes('disabled=""'), 'Disabled button must have disabled attribute');
  assert.ok(disabledHtml.includes('disabled:cursor-not-allowed'), 'Must contain disabled cursor style');

  // Test loading state
  const loadingHtml = renderToStaticMarkup(
    React.createElement(Button, { isLoading: true }, 'Loading Button')
  );
  assert.ok(loadingHtml.includes('disabled=""'), 'Loading button must be disabled');
  assert.ok(loadingHtml.includes('animate-spin'), 'Loading button must contain spinner');

  // Test icon handling with loading: spinner should replace leftIcon
  const iconAndLoadingHtml = renderToStaticMarkup(
    React.createElement(
      Button,
      {
        isLoading: true,
        leftIcon: React.createElement('span', { id: 'test-icon' }, 'ICON'),
      },
      'Loading with Icon'
    )
  );
  assert.ok(iconAndLoadingHtml.includes('animate-spin'), 'Must show spinner');
  assert.ok(!iconAndLoadingHtml.includes('id="test-icon"'), 'Spinner must take precedence over leftIcon');
});

// ============================================================================
// STRESS TEST: Input Accessibility, Labels & Error States
// ============================================================================
test('STRESS: Input label association and id generation', () => {
  const htmlWithLabel = renderToStaticMarkup(
    React.createElement(Input, { label: 'Bank Account Number' })
  );
  assert.ok(htmlWithLabel.includes('for="bank-account-number"'), 'Label htmlFor must be slugified label text');
  assert.ok(htmlWithLabel.includes('id="bank-account-number"'), 'Input id must match label htmlFor');

  const htmlWithCustomId = renderToStaticMarkup(
    React.createElement(Input, { label: 'Custom Label', id: 'custom-input-id' })
  );
  assert.ok(htmlWithCustomId.includes('for="custom-input-id"'), 'Explicit id must override auto-slug');
  assert.ok(htmlWithCustomId.includes('id="custom-input-id"'), 'Input must use explicit id');
});

test('STRESS: Input error state precedence over helper text', () => {
  const htmlWithError = renderToStaticMarkup(
    React.createElement(Input, {
      label: 'Email Address',
      error: 'Invalid NUBAN account format',
      helperText: 'Enter 10-digit account number',
    })
  );
  assert.ok(htmlWithError.includes('Invalid NUBAN account format'), 'Error message must be rendered');
  assert.ok(htmlWithError.includes('border-danger'), 'Input must have border-danger on error');
  assert.ok(!htmlWithError.includes('Enter 10-digit account number'), 'Helper text must be suppressed when error exists');
});

// ============================================================================
// STRESS TEST: Badge Variants, Icons & Pill Shape
// ============================================================================
test('STRESS: Badge variants 6 types x 2 sizes render pill shape and icons', () => {
  const variants = ['approved', 'pending', 'rejected', 'draft', 'brand', 'neutral'] as const;
  const sizes = ['sm', 'md'] as const;

  for (const variant of variants) {
    for (const size of sizes) {
      const html = renderToStaticMarkup(
        React.createElement(Badge, { variant, size }, `Status ${variant}`)
      );
      assert.ok(html.includes('rounded-full'), `Badge [${variant}, ${size}] must be rounded-full`);
      assert.ok(html.includes(`Status ${variant}`), 'Badge missing label text');

      // Check default icons presence
      if (variant === 'approved' || variant === 'pending' || variant === 'rejected' || variant === 'draft') {
        assert.ok(html.includes('<svg'), `Badge [${variant}] must include default SVG icon`);
      }
    }
  }

  // Check icon={false} suppresses icon
  const noIconHtml = renderToStaticMarkup(
    React.createElement(Badge, { variant: 'approved', icon: false }, 'Approved No Icon')
  );
  assert.ok(!noIconHtml.includes('<svg'), 'Badge icon={false} must not render SVG icon');
});

// ============================================================================
// STRESS TEST: Card Variants & Padding Matrix
// ============================================================================
test('STRESS: Card variants 3 types x 4 padding options render with 12px radius', () => {
  const variants = ['surface', 'subtle', 'interactive'] as const;
  const paddings = ['none', 'sm', 'md', 'lg'] as const;

  for (const variant of variants) {
    for (const padding of paddings) {
      const html = renderToStaticMarkup(
        React.createElement(Card, { variant, padding }, `Card ${variant} ${padding}`)
      );
      assert.ok(html.includes('rounded-[12px]'), `Card [${variant}, ${padding}] must have rounded-[12px]`);

      if (variant === 'surface') {
        assert.ok(html.includes('bg-surface'), 'Surface card must have bg-surface');
      } else if (variant === 'subtle') {
        assert.ok(html.includes('bg-subtle'), 'Subtle card must have bg-subtle');
      } else if (variant === 'interactive') {
        assert.ok(html.includes('cursor-pointer'), 'Interactive card must have cursor-pointer');
      }
    }
  }
});

// ============================================================================
// STRESS TEST: Skeleton Variants & Dimension Styles
// ============================================================================
test('STRESS: Skeleton variants render correct border radius and inline styles', () => {
  const textHtml = renderToStaticMarkup(
    React.createElement(Skeleton, { variant: 'text', width: 240, height: 16 })
  );
  assert.ok(textHtml.includes('rounded-[4px]'), 'Text skeleton must have rounded-[4px]');
  assert.ok(textHtml.includes('width:240px'), 'Numeric width must convert to px');
  assert.ok(textHtml.includes('height:16px'), 'Numeric height must convert to px');
  assert.ok(textHtml.includes('aria-hidden="true"'), 'Skeleton must be aria-hidden');

  const circularHtml = renderToStaticMarkup(
    React.createElement(Skeleton, { variant: 'circular', width: '48px', height: '48px' })
  );
  assert.ok(circularHtml.includes('rounded-full'), 'Circular skeleton must have rounded-full');

  const rectangularHtml = renderToStaticMarkup(
    React.createElement(Skeleton, { variant: 'rectangular', width: '100%', height: 120 })
  );
  assert.ok(rectangularHtml.includes('rounded-[7px]'), 'Rectangular skeleton must have rounded-[7px]');
});

// ============================================================================
// STRESS TEST: Tabs Active Underline and Count Badges
// ============================================================================
test('STRESS: Tabs component active tab indicator and count pill rendering', () => {
  const sampleTabs = [
    { id: 'all', label: 'All Requests', count: 14 },
    { id: 'pending', label: 'Pending Review', count: 3 },
    { id: 'history', label: 'History' },
  ];

  const html = renderToStaticMarkup(
    React.createElement(Tabs, {
      tabs: sampleTabs,
      activeTab: 'pending',
      onChange: () => {},
    })
  );

  assert.ok(html.includes('Pending Review'), 'Must render tab label');
  assert.ok(html.includes('14'), 'Must render count 14');
  assert.ok(html.includes('3'), 'Must render count 3');
  assert.ok(html.includes('bg-accent-soft text-brand font-bold'), 'Active tab count pill must have highlight styling');
});

// ============================================================================
// STRESS TEST: Modal & Drawer Safe SSR Guards
// ============================================================================
test('STRESS: Modal and Drawer SSR safety in Node environment without document', () => {
  // Modal should return empty string (null in React) safely when document is undefined or closed
  const modalClosed = renderToStaticMarkup(
    React.createElement(Modal, { isOpen: false, onClose: () => {} }, 'Modal Content')
  );
  assert.equal(modalClosed, '', 'Closed modal must render nothing');

  const modalOpen = renderToStaticMarkup(
    React.createElement(Modal, { isOpen: true, onClose: () => {} }, 'Modal Content')
  );
  assert.equal(modalOpen, '', 'Open modal in SSR (no document) must guard safely without crashing');

  // Drawer should return empty string safely when document is undefined or closed
  const drawerClosed = renderToStaticMarkup(
    React.createElement(Drawer, { isOpen: false, onClose: () => {} }, 'Drawer Content')
  );
  assert.equal(drawerClosed, '', 'Closed drawer must render nothing');

  const drawerOpen = renderToStaticMarkup(
    React.createElement(Drawer, { isOpen: true, onClose: () => {} }, 'Drawer Content')
  );
  assert.equal(drawerOpen, '', 'Open drawer in SSR (no document) must guard safely without crashing');
});
