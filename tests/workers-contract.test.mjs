import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const source = readFileSync(new URL('../src/app/workers/page.tsx', import.meta.url), 'utf8');

test('workers page should be branded as GA-Claw worker nodes', () => {
  assert.match(source, /GA-Claw Worker Nodes/);
  assert.match(source, /adapter/);
  assert.match(source, /heartbeat/);
});
