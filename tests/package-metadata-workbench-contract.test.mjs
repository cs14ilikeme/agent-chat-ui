import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const source = readFileSync(new URL('../package.json', import.meta.url), 'utf8');

test('package metadata should identify the GA-Claw workbench package line', () => {
  assert.match(source, /ga-claw|workbench/i);
  assert.doesNotMatch(source, /ga-go-ui/);
  assert.doesNotMatch(source, /langchain-ai\/agent-chat-ui/);
});
