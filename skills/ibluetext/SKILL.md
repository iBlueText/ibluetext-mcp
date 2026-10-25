---
name: ibluetext
description: Send iMessage, SMS and WhatsApp to customers, run text campaigns, check which phone numbers are iPhones, and read replies with iBlueText. Use when the user wants to text a customer or a list, follow up with leads by text, see who replied, or check whether numbers have iMessage or WhatsApp.
---

# iBlueText: business texting (iMessage, SMS, WhatsApp)

iBlueText sends real blue-bubble iMessage (and SMS/RCS to Android, and WhatsApp) from the business's own dedicated number. Everything below works with the user's iBlueText API key or the hosted connector.

## Connect (pick one)
- **MCP tools available?** If tools like `send_message` / `ibt_send` exist, use them.
- **Hosted connector:** `https://ibluetext.com/mcp` (OAuth sign-in, no key). Claude: Settings › Connectors › Add custom connector.
- **Local MCP:** `npx -y ibluetext-mcp` with env `IBT_API_KEY` (key from https://ibluetext.com/portal/integrations.php).
- **Plain REST:** `Authorization: Bearer $IBT_API_KEY` against `https://ibluetext.com/api/v1`. Spec: https://ibluetext.com/openapi.json

## Common tasks (REST)
```bash
# Is it an iPhone? (uses lookup credits)
curl -sS https://ibluetext.com/api/v1/lookup -H "Authorization: Bearer $IBT_API_KEY" \
  -H "Content-Type: application/json" -d '{"numbers":["+18135550142"]}'      # -> {id}; then GET /lookup?id=<id>

# Send one message (channel auto = iMessage for iPhones, SMS otherwise)
curl -sS https://ibluetext.com/api/v1/send -H "Authorization: Bearer $IBT_API_KEY" \
  -H "Content-Type: application/json" -d '{"to":"+18135550142","body":"Hi Sam, your order is ready."}'

# Campaign to a list with merge fields
curl -sS https://ibluetext.com/api/v1/campaigns -H "Authorization: Bearer $IBT_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"name":"Oct follow-up","message":"Hey, is this {first_name}?","channel":"auto","recipients":[{"phone":"+18135550142","first_name":"Sam"}]}'

# Read replies (transcripts + lead score)
curl -sS "https://ibluetext.com/api/v1/conversations?limit=50" -H "Authorization: Bearer $IBT_API_KEY"
```

## Rules to follow
1. **Confirm before sending.** Show the user the exact message and the recipients (or the count) and get a yes before any send or campaign.
2. **Never text opted-out people.** The API removes them from campaigns; don't try to work around it.
3. **Every `{merge}` field must exist on every recipient**, or the campaign is refused with the reason. Fix the list, don't drop the field silently.
4. **HTTP 402 = a person must pay.** Tell the user to add credits or a line at https://ibluetext.com/portal/ — you can't pay for them.
5. **Daily limits are normal.** Messages over a line's new-contact limit wait and send later; report `waiting`/`held`, don't retry.
6. **WhatsApp:** open with a short question ("Hey, is this {first_name}?"). Numbers with low reply rates get slowed or banned.

More: https://ibluetext.com/ai-assistants · https://ibluetext.com/llms.txt · support russ@ibluetext.com
