import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const source = readFileSync(new URL('../src/app/tools/page.tsx', import.meta.url), 'utf8');

test('tools page should be branded as GA-Claw tool leases', () => {
  assert.match(source, /GA-Claw Tool Leases/);
  assert.match(source, /工具租约/);
  assert.match(source, /createGaClawClient|createHubClient/);
});
