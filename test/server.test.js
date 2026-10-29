// Starts the real server over stdio (no API key, no network calls) and checks what an MCP client sees.
// Run: npm test
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

const entry = fileURLToPath(new URL('../index.js', import.meta.url));
const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url)));
let client, tools;

before(async () => {
  client = new Client({ name: 'ibluetext-mcp-test', version: '1' });
  await client.connect(new StdioClientTransport({ command: process.execPath, args: [entry], env: { PATH: process.env.PATH }, stderr: 'ignore' }));
  ({ tools } = await client.listTools());
});
after(() => client?.close());

test('reports the package version', () => {
  assert.equal(client.getServerVersion().version, pkg.version);
});

test('exposes all 30 tools, each with a description', () => {
  assert.equal(tools.length, 30);
  for (const t of tools) assert.ok(t.description?.length > 10, `${t.name} has no description`);
});

test('every tool has a title and read-only / destructive / idempotent / open-world hints', () => {
  for (const t of tools) {
    assert.ok(t.title, `${t.name} has no title`);
    for (const h of ['readOnlyHint', 'destructiveHint', 'idempotentHint', 'openWorldHint'])
      assert.equal(typeof t.annotations?.[h], 'boolean', `${t.name} is missing ${h}`);
  }
});

test('read-only tools are never marked destructive', () => {
  for (const t of tools) if (t.annotations.readOnlyHint) assert.equal(t.annotations.destructiveHint, false, t.name);
});

test('tools that message real people are marked as not read-only and open-world', () => {
  for (const name of ['ibt_send', 'ibt_campaign_create', 'ibt_whatsapp_send', 'ibt_verify_start']) {
    const t = tools.find((x) => x.name === name);
    assert.equal(t.annotations.readOnlyHint, false, name);
    assert.equal(t.annotations.destructiveHint, true, name);
    assert.equal(t.annotations.openWorldHint, true, name);
  }
});

test('input schemas are published (recipients, fields, line_id survive the zod 4 upgrade)', () => {
  const props = (n) => tools.find((t) => t.name === n).inputSchema.properties;
  assert.ok(props('ibt_send').to);
  assert.ok(props('ibt_campaign_create').recipients);
  assert.ok(props('ibt_contact_update').fields);
});

test('bad input is rejected before any network call', async () => {
  const r = await client.callTool({ name: 'ibt_lookup_status', arguments: { id: 'not-a-number' } }).catch((e) => ({ isError: true, e }));
  assert.equal(r.isError, true);
});

test('the API key can only be sent to ibluetext.com', () => {
  const src = readFileSync(entry, 'utf8');
  assert.match(src, /const BASE = 'https:\/\/ibluetext\.com\/api\/v1';/);
  const envReads = [...src.matchAll(/process\.env\.(\w+)/g)].map((m) => m[1]);
  assert.deepEqual(envReads, ['IBT_API_KEY'], 'only the API key may come from the environment');
  const fetches = [...src.matchAll(/fetch\(([^,]+),/g)].map((m) => m[1].trim());
  assert.deepEqual(fetches, ['BASE + path'], 'every request goes to BASE');
});
