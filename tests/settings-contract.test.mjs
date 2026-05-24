import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const source = readFileSync(new URL('../src/app/settings/page.tsx', import.meta.url), 'utf8');

test('settings page should be branded as GA-Claw operations settings', () => {
  assert.match(source, /GA-Claw/);
  assert.match(source, /工作台/);
  assert.match(source, /API 地址/);
});
