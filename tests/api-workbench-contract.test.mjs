import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const proxy = readFileSync(new URL('../src/app/api/gago/[...path]/route.ts', import.meta.url), 'utf8');
const health = readFileSync(new URL('../src/app/api/health/route.ts', import.meta.url), 'utf8');

test('api proxy should expose GA-Claw Hub branding while preserving compatibility envs', () => {
  assert.match(proxy, /GA_CLAW_HUB_URL/);
  assert.match(proxy, /GAGO_API_URL/);
  assert.match(proxy, /GA-Claw Hub proxy error/);
  assert.doesNotMatch(proxy, /GA-Go proxy error|GA-Go backend/);
});

test('health route should report GA-Claw Hub connectivity', () => {
  assert.match(health, /GA-Claw Hub/);
  assert.match(health, /GA_CLAW_HUB_URL/);
  assert.match(health, /GAGO_API_URL/);
  assert.doesNotMatch(health, /GA-Go API/);
});
