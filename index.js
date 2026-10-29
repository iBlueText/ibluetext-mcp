#!/usr/bin/env node
/* iBlueText MCP server — exposes the iBlueText REST API to AI agents as tools.
 * Auth: set IBT_API_KEY (create one at https://ibluetext.com/portal/integrations.php).
 * Run: IBT_API_KEY=ibt_... npx ibluetext-mcp  (or add to your MCP client config).
 * 0.3.2 (2026-10-29): annotations + API host written out literally on every call so scanners can read them.
 * 0.3.1 (2026-10-29): security hardening. API host is fixed to https://ibluetext.com (the key can only go there), MCP SDK 1.32 + zod 4.6
 *   (patched advisories), and every tool carries read-only / destructive / open-world annotations so clients know which ones need a confirm.
 * 0.3.0 (2026-10-21): pause/resume AI per conversation (ibt_conversation_ai), Quick answers (ibt_quick_answers, ibt_quick_answer_set). 30 tools.
 * 0.2.0 (2026-10-21): campaigns, WhatsApp (send / status / numbers with warm-up + reply rate), WhatsApp lookup (beta),
 * conversations, contact records with lead score, lines, sequences, reactions, webhooks; send gains channel/media/effect. */
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';

const KEY = process.env.IBT_API_KEY || '';
const VERSION = '0.3.2';

async function api(method, path, body) {
  const r = await fetch(`https://ibluetext.com/api/v1${path}`, {
    method,
    headers: { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json', 'User-Agent': `ibluetext-mcp/${VERSION}` },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await r.text();
  let json; try { json = JSON.parse(text); } catch { json = { raw: text }; }
  return { status: r.status, json };
}
const ok = (obj) => ({ content: [{ type: 'text', text: JSON.stringify(obj, null, 2) }] });
// every tool answers with the API's JSON; a 402 is flagged so the agent tells its human (only a human can pay)
const reply = ({ status, json }) => ok(status === 402 ? { payment_required: true, human_action_required: true, ...json } : status >= 400 ? { http_status: status, ...json } : json);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const qs = (o) => { const p = Object.entries(o).filter(([, v]) => v !== undefined && v !== null && v !== '').map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`); return p.length ? '?' + p.join('&') : ''; };
const strip = (o) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined));

const server = new McpServer({ name: 'ibluetext', version: VERSION });

// what each tool does to the world, so MCP clients can skip confirms on reads and ask before sends.
// read = only reads the account; spend = uses credits, changes nothing else; send = messages a real person (can't be unsent);
// change = edits account settings/records; overwrite = replaces or deletes settings/records
// each tool: server.tool(name, description, input schema, annotations, handler)

// ---------- account
server.tool('ibt_balance', 'Check the iBlueText wallet: prepaid credits, free-trial + free-daily lookups, free verifications, and per-line daily usage. Use this before paid actions to warn the user if they need to top up.', {}, { title: 'Check balance', readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false }, async () => reply(await api('GET', '/balance')));

server.tool('ibt_lines', 'List the account\'s sending lines: status, today\'s new-contact cap and usage per channel, health (last sent, failures, last error), send window and webhook. A key limited to one line sees only that line.', {}, { title: 'List sending lines', readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false }, async () => reply(await api('GET', '/lines')));

// ---------- lookup
server.tool('ibt_lookup', 'Check which phone numbers are on iMessage (iPhone). Submits the list, waits for results, and returns each number tagged imessage true/false. Costs 1 credit each beyond the free allowance (returns a 402 with buy_url if out — a HUMAN must pay).', {
  numbers: z.array(z.string()).describe('Phone numbers in E.164, e.g. ["+18135550142"]'),
}, { title: 'Check iPhones (iMessage lookup)', readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true }, async ({ numbers }) => {
  const sub = await api('POST', '/lookup', { numbers });
  if (sub.status === 402 || !sub.json.id) return reply(sub);
  const id = sub.json.id;
  for (let i = 0; i < 60; i++) { await sleep(2000); const r = await api('GET', `/lookup?id=${id}`); if (r.json.status === 'done') return ok(r.json); }
  return ok({ id, status: 'still running', note: 'Call ibt_lookup_status with this id later.' });
});

server.tool('ibt_lookup_status', 'Get the status and results of an iPhone lookup job by id.', { id: z.number() }, { title: 'iPhone lookup results', readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false }, async ({ id }) => reply(await api('GET', `/lookup?id=${id}`)));

server.tool('ibt_wa_lookup', 'BETA (enabled per account; 403 if not yet): check which numbers are on WhatsApp ($0.002/number; numbers WhatsApp gives no clear answer for come back null and are refunded). WhatsApp checks run slowly on purpose, so this returns the job id; poll with ibt_wa_lookup_status. also_imessage:true runs the iPhone lookup on the same list too.', {
  numbers: z.array(z.string()), also_imessage: z.boolean().optional(),
}, { title: 'Check WhatsApp numbers', readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true }, async ({ numbers, also_imessage }) => reply(await api('POST', '/wa_lookup', strip({ numbers, also_imessage }))));

server.tool('ibt_wa_lookup_status', 'BETA: status and results of a WhatsApp lookup job (whatsapp: true | false | null per number).', { id: z.number() }, { title: 'WhatsApp lookup results', readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false }, async ({ id }) => reply(await api('GET', `/wa_lookup?id=${id}`)));

// ---------- sending
server.tool('ibt_send', 'Send one iMessage/SMS to one person (with optional attachments). Requires an active sending line — returns 402 with buy_url if none. channel auto = iMessage for iPhones, SMS for everyone else.', {
  to: z.string().describe('Recipient phone in E.164'),
  body: z.string().describe('Message text. {firstname} is personalized if first_name is given.'),
  first_name: z.string().optional(),
  channel: z.enum(['auto', 'imessage', 'sms']).optional(),
  line_id: z.number().optional().describe('Send from this line (default: the line the conversation is on).'),
  media_urls: z.array(z.string()).optional().describe('https links to a photo, video, voice memo, .vcf or PDF (up to 5, 5 MB each).'),
  effect: z.string().optional().describe('iMessage effect, e.g. confetti, balloons, slam, invisible_ink.'),
  reply_to: z.string().optional().describe('Quote-reply to an inbound message_id like "in_3909".'),
  send_at: z.string().optional().describe('Schedule (ISO 8601, up to 30 days ahead).'),
}, { title: 'Send iMessage / SMS', readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: true }, async ({ media_urls, ...a }) => reply(await api('POST', '/send', strip({ ...a, media: media_urls?.map((url) => ({ url })) }))));

server.tool('ibt_send_status', 'Status of a sent iMessage/SMS by id (queued, sent, delivered, failed + error).', { id: z.number() }, { title: 'Message status', readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false }, async ({ id }) => reply(await api('GET', `/send?id=${id}`)));

server.tool('ibt_react', 'Put an iMessage reaction (tapback) on a message someone sent you: love, like, dislike, laugh, emphasize, question ("-love" removes it). Use message_id from conversations/webhooks, or "to" for their latest message.', {
  reaction: z.string(), message_id: z.string().optional(), to: z.string().optional(), line_id: z.number().optional(),
}, { title: 'React to a message', readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: true }, async (a) => reply(await api('POST', '/react', strip(a))));

// ---------- campaigns
server.tool('ibt_campaign_create', 'Send one message to a whole list, exactly like the dashboard Campaigns page. Opt-outs and duplicates are removed; every {merge} field must exist on the recipients (else nothing is sent and you get the reason). channel: imessage, sms, auto (looks each number up first, then iMessage or SMS) or whatsapp (from the account\'s WhatsApp numbers; each number\'s warm-up applies — 10 new conversations on day 1 rising to 300/day by day 21 — and anyone who never replied to the last 3 WhatsApp messages is skipped). TIP for WhatsApp: open with a question like "Hey, is this {first_name}?" — low reply rates get numbers banned.', {
  name: z.string().describe('Unique campaign name'),
  message: z.string().describe('Text with {merge} fields, e.g. "Hey, is this {first_name}?"'),
  recipients: z.union([z.array(z.union([z.string(), z.record(z.string(), z.any())])), z.string()]).describe('List of {phone, first_name, ...any fields} (or bare phone strings), or CSV text with a header row.'),
  channel: z.enum(['imessage', 'sms', 'auto', 'whatsapp']).optional(),
  line_id: z.union([z.number(), z.enum(['all', 'reserved'])]).optional().describe('Default "all" (spread across your lines).'),
  wa_session_id: z.number().optional().describe('WhatsApp: send from this one number (see ibt_whatsapp_numbers).'),
  media_urls: z.array(z.string()).optional(),
  effect: z.string().optional(),
}, { title: 'Send a campaign', readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: true }, async ({ media_urls, ...a }) => reply(await api('POST', '/campaigns', strip({ ...a, media: media_urls?.map((url) => ({ url })) }))));

server.tool('ibt_campaigns', 'List recent campaigns (id, name, channel, status, total, sent, replies).', { limit: z.number().optional() }, { title: 'List campaigns', readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false }, async ({ limit }) => reply(await api('GET', `/campaigns${qs({ limit })}`)));

server.tool('ibt_campaign_status', 'One campaign with stats: sent, delivered, read, failed, waiting, held by warm-up/daily cap, replies, reply rate and any skipped note.', { id: z.number() }, { title: 'Campaign stats', readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false }, async ({ id }) => reply(await api('GET', `/campaigns?id=${id}`)));

server.tool('ibt_campaign_pause', 'Pause or resume a campaign.', { id: z.number(), action: z.enum(['pause', 'resume']) }, { title: 'Pause or resume a campaign', readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false }, async (a) => reply(await api('POST', '/campaigns', a)));

// ---------- WhatsApp
server.tool('ibt_whatsapp_send', 'Send a WhatsApp message from the account\'s linked or hosted WhatsApp number. Over the number\'s daily new-contact limit it waits (held_until) and sends automatically. Someone who never replied gets at most 3 messages: the 3rd returns a "warning", a 4th is refused (code no_reply_limit) until they reply.', {
  to: z.string(), body: z.string().optional(), media_url: z.string().optional().describe('One file per message (≤16 MB); body becomes the caption.'), session_id: z.number().optional(),
}, { title: 'Send WhatsApp', readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: true }, async (a) => reply(await api('POST', '/whatsapp', strip(a))));

server.tool('ibt_whatsapp_status', 'Status of a WhatsApp message by id (queued, sent, delivered, read, failed); held_until/held_reason while it waits on the warm-up limit.', { id: z.number() }, { title: 'WhatsApp message status', readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false }, async ({ id }) => reply(await api('GET', `/whatsapp?id=${id}`)));

server.tool('ibt_whatsapp_numbers', 'The account\'s WhatsApp numbers with warm-up (day N of 21, today\'s new-contact limit, used, left, held), 7/30-day reply rate, health (good/watch/risk), slowed flag (reply rate under 15% halves the limit) and hosted flag. Check this before a big WhatsApp send.', {}, { title: 'WhatsApp numbers & warm-up', readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false }, async () => reply(await api('GET', '/whatsapp?numbers=1')));

// ---------- contacts & conversations
server.tool('ibt_conversations', 'Full two-way transcripts per contact (in/out messages, channel, status, attachments) plus fields, opt-out and lead score. Default: only contacts who replied.', {
  phone: z.string().optional(), since: z.string().optional().describe('ISO time: only conversations with newer activity'), limit: z.number().optional(), include_no_reply: z.boolean().optional(),
}, { title: 'Read conversations', readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false }, async ({ include_no_reply, ...a }) => reply(await api('GET', `/conversations${qs({ ...a, include_no_reply: include_no_reply ? 1 : undefined })}`)));

server.tool('ibt_conversation_ai', 'Pause or resume the built-in iBlueText AI in one conversation so a person can take over (pause lasts until resumed). The AI also steps back by itself for 24h after someone replies by hand.', {
  phone: z.string(), ai: z.enum(['pause', 'resume']),
}, { title: 'Pause or resume AI in a conversation', readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false }, async (a) => reply(await api('POST', '/conversations', a)));

server.tool('ibt_quick_answers', 'List Quick answers: free keyword auto-replies checked before the AI (never counted as AI replies; keep AI costs low).', {}, { title: 'List Quick answers', readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false }, async () => reply(await api('GET', '/quick_answers')));

server.tool('ibt_quick_answer_set', 'Add a Quick answer {keywords:"hours, open", reply, match:"contains"|"exact"}, or change one by id (active:false to turn off, delete:true to remove).', {
  keywords: z.string().optional().describe('comma-separated words/phrases; any one matches'), reply: z.string().optional(), match: z.enum(['contains', 'exact']).optional(),
  id: z.number().optional(), active: z.boolean().optional(), delete: z.boolean().optional(),
}, { title: 'Add, change or delete a Quick answer', readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: false }, async (a) => reply(await api('POST', '/quick_answers', strip(a))));

server.tool('ibt_contact', 'One contact record: fields, tags, opt-out, last activity and lead score (0-100 + hot/warm/cold tier).', { phone: z.string() }, { title: 'Get a contact', readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false }, async ({ phone }) => reply(await api('GET', `/contacts${qs({ phone })}`)));

server.tool('ibt_contact_update', 'Create or update a contact: merge fields, add/remove tags (a tag can start a tag-triggered sequence), set opted_out. opted_out:false re-subscribes — only if the person asked to hear from you again. fields.lead_tier = hot|warm|cold|dead overrides the lead tier.', {
  phone: z.string(), fields: z.record(z.string(), z.string()).optional(), tags: z.array(z.string()).optional(), remove_tags: z.array(z.string()).optional(), opted_out: z.boolean().optional(),
}, { title: 'Create or update a contact', readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: false }, async (a) => reply(await api('POST', '/contacts', strip(a))));

server.tool('ibt_contacts', 'Pull widget-verified contacts (phone, name, email, channel, verified time) to sync into a CRM. Paginate with since/limit.', {
  since: z.number().optional(), limit: z.number().optional(),
}, { title: 'List verified contacts', readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false }, async ({ since, limit }) => reply(await api('GET', `/contacts?since=${since || 0}&limit=${limit || 200}`)));

server.tool('ibt_sequences', 'List sequences (drip follow-ups that stop when the contact replies).', {}, { title: 'List sequences', readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false }, async () => reply(await api('GET', '/sequences')));

server.tool('ibt_sequence_enroll', 'Enroll a contact in a sequence (skips opted-out / already enrolled), or stop them with stop:true.', {
  sequence_id: z.number(), phone: z.string(), stop: z.boolean().optional(),
}, { title: 'Enroll in or stop a sequence', readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true }, async (a) => reply(await api('POST', '/sequences', strip(a))));

// ---------- webhooks
server.tool('ibt_webhooks', 'Read the reply-webhook setup: signing secret, account webhook, per-line webhooks, events.', {}, { title: 'Read webhook setup', readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false }, async () => reply(await api('GET', '/webhooks')));

server.tool('ibt_webhooks_set', 'Point incoming replies at your bot: url ("" clears), lines ("account" default | "all" | "reserved" | [line ids]), replies_handled_by_webhook (default true: built-in AI stays quiet), test:true sends a message.test event, status_events turns on opt-in events (message.sent, message.delivered, message.failed, message.read, reaction.received, line.status, contact.created, call.*).', {
  url: z.string().nullable().optional(), lines: z.union([z.enum(['account', 'all', 'reserved']), z.array(z.number())]).optional(),
  replies_handled_by_webhook: z.boolean().optional(), test: z.boolean().optional(), status_events: z.array(z.string()).optional(),
}, { title: 'Set reply webhooks', readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: false }, async (a) => reply(await api('POST', '/webhooks', strip(a))));

// ---------- verification
server.tool('ibt_verify_start', 'Start an SMS/iMessage verification: sends a 6-digit code to a phone. Returns an id to check the code with. First 10 verifications are free.', {
  phone: z.string(), name: z.string().optional(), email: z.string().optional(),
}, { title: 'Send a verification code', readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: true }, async ({ phone, name, email }) => reply(await api('POST', '/verify', strip({ phone, name, email }))));

server.tool('ibt_verify_check', 'Check a verification code the user entered. Returns { verified, token, channel }.', {
  id: z.number(), code: z.string(),
}, { title: 'Check a verification code', readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false }, async ({ id, code }) => reply(await api('POST', '/verify?action=check', { id, code })));

server.tool('ibt_create_site', 'Create an SMS-Verify widget site. Returns a site_key (for the widget) + secret (for /siteverify) + ready-to-paste embed.', {
  name: z.string(), domains: z.string().optional().describe('Comma-separated allowed domains'), theme: z.enum(['auto', 'light', 'dark']).optional(),
}, { title: 'Create a Verify widget site', readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false }, async ({ name, domains, theme }) => reply(await api('POST', '/sites', strip({ name, domains, theme }))));

if (!KEY) console.error('[ibluetext-mcp] WARNING: IBT_API_KEY not set — calls will return 401.');
await server.connect(new StdioServerTransport());
console.error(`[ibluetext-mcp] ${VERSION} ready`);
