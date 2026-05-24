import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const source = readFileSync(new URL('../src/app/templates/page.tsx', import.meta.url), 'utf8');

test('template import/export should use GA-Claw naming for persisted workbench actions', () => {
  assert.match(source, /GA-Claw 协作动作模板/);
  assert.match(source, /ga-claw-action-templates/);
  assert.match(source, /ga-claw-templates-/);
  assert.doesNotMatch(source, /ga-go-templates-/);
});
