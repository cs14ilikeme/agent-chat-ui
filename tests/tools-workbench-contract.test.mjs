import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const source = readFileSync(new URL('../src/app/tools/page.tsx', import.meta.url), 'utf8');

test('tools page should describe GA-Claw tool lease gateway rather than GA-Go backend gaps', () => {
  assert.match(source, /GA-Claw Tool Leases/);
  assert.match(source, /工具租约/);
  assert.match(source, /Hub 工具网关/);
  assert.doesNotMatch(source, /GA-Go 后端/);
});
