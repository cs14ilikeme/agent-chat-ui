import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const hubRoute = readFileSync(new URL('../src/app/api/hub/[...path]/route.ts', import.meta.url), 'utf8');
const home = readFileSync(new URL('../src/app/page.tsx', import.meta.url), 'utf8');
const settings = readFileSync(new URL('../src/app/settings/page.tsx', import.meta.url), 'utf8');
const templates = readFileSync(new URL('../src/app/templates/page.tsx', import.meta.url), 'utf8');
const workers = readFileSync(new URL('../src/app/workers/page.tsx', import.meta.url), 'utf8');

test('hub alias route should proxy to GA-Claw Hub', () => {
  assert.match(hubRoute, /GA_CLAW_HUB_URL/);
  assert.match(hubRoute, /GA-Claw Hub proxy error/);
  assert.doesNotMatch(hubRoute, /GA-Go proxy error/);
});

test('primary workbench pages should prefer /api/hub by default', () => {
  assert.match(home, /\/api\/hub/);
  assert.match(settings, /\/api\/hub/);
  assert.match(templates, /\/api\/hub/);
  assert.match(workers, /\/api\/hub/);
});
