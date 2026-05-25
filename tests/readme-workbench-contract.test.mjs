import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const source = readFileSync(new URL('../README.md', import.meta.url), 'utf8');

test('README should describe GA-Claw Workbench as the product line', () => {
  assert.match(source, /GA-Claw Workbench/);
  assert.match(source, /Room/);
  assert.match(source, /Approval/);
  assert.match(source, /Workspace/);
  assert.match(source, /Artifact/);
  assert.match(source, /GA_CLAW_HUB_URL/);
  assert.doesNotMatch(source, /^# GA-Go UI/m);
});
