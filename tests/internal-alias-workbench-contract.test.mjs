import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { test } from 'node:test';

const hubClientPath = new URL('../src/lib/hub-client.ts', import.meta.url);
const hubTypesPath = new URL('../src/lib/hub-types.ts', import.meta.url);
const home = readFileSync(new URL('../src/app/page.tsx', import.meta.url), 'utf8');
const tools = readFileSync(new URL('../src/app/tools/page.tsx', import.meta.url), 'utf8');
const settings = readFileSync(new URL('../src/app/settings/page.tsx', import.meta.url), 'utf8');
const templates = readFileSync(new URL('../src/app/templates/page.tsx', import.meta.url), 'utf8');
const workers = readFileSync(new URL('../src/app/workers/page.tsx', import.meta.url), 'utf8');

test('GA-Claw client and type aliases should exist for new imports', () => {
  assert.equal(existsSync(hubClientPath), true);
  assert.equal(existsSync(hubTypesPath), true);
  const client = readFileSync(hubClientPath, 'utf8');
  const types = readFileSync(hubTypesPath, 'utf8');
  assert.match(client, /createGaClawClient/);
  assert.match(client, /GaClawHubClient/);
  assert.match(types, /export \* from ['"]\.\/gago-types['"]/);
});

test('primary pages should import GA-Claw aliases while legacy client remains available', () => {
  for (const source of [home, tools, settings, templates, workers]) {
    assert.doesNotMatch(source, /createGAGoClient/);
    assert.doesNotMatch(source, /@\/lib\/gago-client/);
  }
  assert.match(home, /@\/lib\/hub-client/);
  assert.match(home, /@\/lib\/hub-types/);
});
