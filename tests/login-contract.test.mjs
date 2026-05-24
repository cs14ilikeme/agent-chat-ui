import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const source = readFileSync(new URL('../src/app/login/page.tsx', import.meta.url), 'utf8');

test('login page should be branded as GA-Claw access', () => {
  assert.match(source, /GA-Claw/);
  assert.match(source, /协作工作台/);
});
