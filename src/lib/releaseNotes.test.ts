import assert from 'node:assert/strict';
import { test } from 'node:test';
import { releaseNotesPeek } from './releaseNotes';

test('previews the matching language and excludes release-page instructions', () => {
  const body = [
    '## Release Notes',
    '<!-- Release template instructions -->',
    '- 🔄 **Faster** [search](https://example.invalid)',
    '<details>',
    '<summary><b>🇪🇸 Español</b></summary>',
    '- 🔄 **Búsqueda** más rápida',
    '### ℹ️ Antes de instalar',
    '- Instrucciones de instalación',
    '</details>',
    '### 📦 Downloads & Packages',
    '- Installer',
  ].join('\n');
  assert.deepEqual(releaseNotesPeek(body, 'en'), ['Faster search']);
  assert.deepEqual(releaseNotesPeek(body, 'es'), ['Búsqueda más rápida']);
});

test('falls back to the available language and returns no more than four highlights', () => {
  assert.deepEqual(releaseNotesPeek(undefined, 'es'), []);
  assert.deepEqual(releaseNotesPeek('### Notes\n- A\n- B\n- B\n- C\n- D\n- E', 'es'), ['A', 'B', 'C', 'D']);
});
