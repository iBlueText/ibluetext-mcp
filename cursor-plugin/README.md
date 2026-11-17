# iBlueText for Grok Bot and Cursor

Text your customers from your AI agent. iBlueText sends real blue-bubble iMessage to iPhones, SMS to everyone else, and WhatsApp, from your business's iBlueText number. Ask your agent to text a customer, send a follow-up campaign to a list, see who replied and draft answers, or check which numbers are iPhones before you send. In Grok Bot, put it on a routine: "every morning at 8, tell me who replied overnight and draft answers".

## What's inside

- **Connector:** the iBlueText MCP server at `https://ibluetext.com/mcp` (Streamable HTTP). It uses OAuth 2.1 with PKCE and dynamic client registration: you sign in with your iBlueText account the first time a tool is used. No client ID, secret or API key is stored in this plugin.
- **Skill (`ibluetext-texting`):** how to use the tools safely: confirm every message and recipient before sending, only send pre-approved messages on scheduled runs, open with a short question and no link for new contacts, respect opt-outs and daily limits, and check numbers before a big send.

## Install

1. Open **Marketplace** (or **Plugins**) in Grok Bot or Cursor and search for **iBlueText**.
2. Choose **Add**, then sign in to iBlueText when the browser opens.

Without the marketplace, ask Grok Bot: "add the custom server https://ibluetext.com/mcp" and click **Authorize** on the connect card.

## What it sends and where

The plugin runs no local code, no hooks and no scripts. Everything goes through the iBlueText connector over HTTPS to ibluetext.com, and only when you ask your agent to do something: the phone numbers, names and message text needed for that task. Messages are delivered from your iBlueText line. Disconnect any time in iBlueText under Portal › Integrations (revoke the "connected app" key).

Privacy policy: <https://ibluetext.com/privacy.php>  
Terms: <https://ibluetext.com/terms.php>

## Getting started

1. Create a free account at https://ibluetext.com (free iPhone lookups and trial texts, no card).
2. Add this plugin, then ask "Who replied to my texts today?" and sign in when asked.
3. To text from your own dedicated number, pick a hosted or self-hosted plan in the iBlueText portal.

## Support

Email russ@ibluetext.com. Docs: https://ibluetext.com/docs/ and https://ibluetext.com/ai-assistants.

## License

MIT. See LICENSE.
