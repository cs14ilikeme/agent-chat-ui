import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const source = readFileSync(new URL('../src/app/templates/page.tsx', import.meta.url), 'utf8');

test('templates page should be branded as GA-Claw workbench actions', () => {
  assert.match(source, /GA-Claw 协作动作模板/);
  assert.match(source, /Room \/ Task \/ Approval \/ Workspace/);
  assert.match(source, /createGaClawClient|createHubClient/);
  assert.match(source, /submitTask/);
});
