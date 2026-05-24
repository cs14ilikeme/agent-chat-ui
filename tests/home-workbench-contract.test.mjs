import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const source = readFileSync(new URL('../src/app/page.tsx', import.meta.url), 'utf8');

test('home page service and task sections should use GA-Claw workbench semantics', () => {
  assert.match(source, /GA-Claw Service Ops/);
  assert.match(source, /GA-Claw Task Queue/);
  assert.match(source, /Room \/ Timeline \/ Approval \/ Workspace/);
  assert.doesNotMatch(source, /\.ga-go\/services\.json/);
});
