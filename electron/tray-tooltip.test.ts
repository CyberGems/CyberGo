import assert from 'node:assert/strict';
import { test } from 'node:test';
import { TRAY_TOOLTIP_MAX_LENGTH, formatTrayTooltip } from './tray-tooltip';

test('the tray tooltip uses the suite format with a single shortcut segment', () => {
  assert.equal(formatTrayTooltip('Alt+Shift+G'), 'CyberGo · Alt+Shift+G');
});

test('the tray tooltip falls back to the bare app name without a shortcut', () => {
  assert.equal(formatTrayTooltip(undefined), 'CyberGo');
  assert.equal(formatTrayTooltip(''), 'CyberGo');
  assert.equal(formatTrayTooltip('   '), 'CyberGo');
  assert.equal(formatTrayTooltip(null), 'CyberGo');
});

test('the tray tooltip trims the segment before formatting', () => {
  assert.equal(formatTrayTooltip('  Alt+Shift+G  '), 'CyberGo · Alt+Shift+G');
});

test('the tray tooltip is capped at 63 characters with an ellipsis', () => {
  const tooltip = formatTrayTooltip('X'.repeat(80));
  assert.equal(tooltip.length, TRAY_TOOLTIP_MAX_LENGTH);
  assert.ok(tooltip.endsWith('…'));
  assert.ok(tooltip.startsWith('CyberGo · '));
});
