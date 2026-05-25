import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const source = readFileSync(new URL('../src/app/services/page.tsx', import.meta.url), 'utf8');

test('services page should be branded as GA-Claw service ops', () => {
  assert.match(source, /GA-Claw Service Ops/);
  assert.match(source, /日志/);
  assert.match(source, /健康/);
});
