# iBlueText for Claude

Text your customers from Claude. iBlueText sends real blue-bubble iMessage to iPhones, SMS to everyone else, and WhatsApp, from your business's iBlueText number. Ask Claude to text a customer, send a follow-up campaign to a list, see who replied and draft answers, or check which numbers are iPhones before you send.

## What's inside

- **Connector:** the iBlueText MCP server at `https://ibluetext.com/mcp`. You sign in with your iBlueText account (OAuth) the first time Claude uses it. No API key is stored in the plugin.
- **Skill (`ibluetext-texting`):** teaches Claude how to use the tools safely: confirm every message and recipient before sending, open with a short question and no link for new contacts, respect opt-outs and daily limits, and check numbers before a big send.

## What it sends and where

The plugin runs no local code and no scripts. Everything goes through the iBlueText connector over HTTPS to ibluetext.com, and only when you ask Claude to do something: the phone numbers, names and message text needed for that task. Messages are delivered from your iBlueText line. Privacy policy: <https://ibluetext.com/privacy.php>  
Terms: <https://ibluetext.com/terms.php>

## Getting started

1. Create a free account at https://ibluetext.com (free iPhone lookups and trial texts, no card).
2. Add this plugin, then ask Claude something like "Who replied to my texts today?" and sign in when asked.
3. To text from your own dedicated number, pick a hosted or self-hosted plan in the iBlueText portal.

## Support

Email russ@ibluetext.com or call/text +1-727-254-9153. Docs: https://ibluetext.com/docs/ and https://ibluetext.com/ai-assistants.

## License

MIT. See LICENSE.
