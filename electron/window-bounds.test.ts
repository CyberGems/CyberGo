import assert from 'node:assert/strict';
import test from 'node:test';
import type { Display } from 'electron';
import { resolveReminderWindowSize, resolveWindowBounds } from './window-bounds';

function display(id: number, x: number, y: number, width: number, height: number): Display {
  const bounds = { x, y, width, height };
  return { id, bounds, workArea: bounds } as Display;
}

const primary = display(1, 0, 0, 1536, 864);
const secondary = display(2, 1536, 0, 1280, 720);

test('restores the saved window on its last monitor and keeps it inside the work area', () => {
  const result = resolveWindowBounds({
    x: 1600,
    y: 80,
    width: 1000,
    height: 600,
    displayId: 2,
    maximized: false,
  }, [primary, secondary], primary);
  assert.equal(result.displayId, 2);
  assert.equal(result.x, 1600);
  assert.equal(result.y, 80);
  assert.equal(result.width, 1000);
  assert.equal(result.height, 600);
});

test('falls back to the primary monitor when the saved monitor is disconnected', () => {
  const result = resolveWindowBounds({
    x: 1700,
    y: 40,
    width: 1200,
    height: 700,
    displayId: 2,
    maximized: true,
  }, [primary], primary);
  assert.equal(result.displayId, 1);
  assert.equal(result.maximized, true);
  assert.ok(result.x >= primary.bounds.x);
  assert.ok(result.y >= primary.bounds.y);
  assert.ok(result.x + result.width <= primary.bounds.x + primary.bounds.width);
  assert.ok(result.y + result.height <= primary.bounds.y + primary.bounds.height);
});

test('clamps oversized or stale bounds instead of spilling across displays', () => {
  const result = resolveWindowBounds({
    x: -5000,
    y: -5000,
    width: 4000,
    height: 3000,
    displayId: 1,
    maximized: false,
  }, [primary], primary);
  assert.ok(result.width <= primary.bounds.width);
  assert.ok(result.height <= primary.bounds.height);
  assert.ok(result.x >= primary.bounds.x);
  assert.ok(result.y >= primary.bounds.y);
});

const reminderLimits = {
  defaultWidth: 420,
  defaultHeight: 560,
  minWidth: 340,
  minHeight: 380,
};

test('the reminder window uses the default size when nothing was stored', () => {
  const result = resolveReminderWindowSize(null, reminderLimits);
  assert.equal(result.width, 420);
  assert.equal(result.height, 560);
  assert.equal(result.manual, false);
});

test('the reminder window keeps the size the user chose', () => {
  const stored = JSON.stringify({ width: 500, height: 700, manual: true });
  const result = resolveReminderWindowSize(stored, reminderLimits);
  assert.equal(result.width, 500);
  assert.equal(result.height, 700);
  assert.equal(result.manual, true);
});

test('a size that was not chosen by the user does not survive the restart', () => {
  const stored = JSON.stringify({ width: 500, height: 700, manual: false });
  const result = resolveReminderWindowSize(stored, reminderLimits);
  assert.equal(result.width, 420);
  assert.equal(result.height, 560);
  assert.equal(result.manual, false);
});

test('a damaged or impossible size falls back to the default one', () => {
  assert.equal(resolveReminderWindowSize('not a size', reminderLimits).manual, false);
  const tooSmall = JSON.stringify({ width: 100, height: 100, manual: true });
  const result = resolveReminderWindowSize(tooSmall, reminderLimits);
  assert.equal(result.width, 420);
  assert.equal(result.height, 560);
  assert.equal(result.manual, false);
});

test('a height below the minimum falls back to the default height', () => {
  const stored = JSON.stringify({ width: 500, height: 120, manual: true });
  const result = resolveReminderWindowSize(stored, reminderLimits);
  assert.equal(result.width, 500);
  assert.equal(result.height, 560);
  assert.equal(result.manual, true);
});
