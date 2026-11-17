---
name: ibluetext-texting
description: Send iMessage, SMS and WhatsApp to customers, run text campaigns, read replies and check which phone numbers are iPhones with iBlueText. Use when the user wants to text a customer or a list, follow up with leads by text, see who replied or needs a reply, or check whether numbers have iMessage or WhatsApp.
---

# iBlueText: business texting from your agent

iBlueText sends real blue-bubble iMessage to iPhones, SMS to everyone else, and WhatsApp, from the business's iBlueText number. This plugin connects to the iBlueText server at `https://ibluetext.com/mcp`. The user signs in with their iBlueText account the first time a tool is used.

## Tools

- **Send:** `send_message` (one person; channel `auto` picks iMessage for iPhones and SMS otherwise), `send_whatsapp`, `react_to_message`.
- **Campaigns:** `create_campaign`, `get_campaign`, `list_campaigns`, `pause_or_resume_campaign`, `list_sequences`, `enroll_in_sequence`.
- **Replies and contacts:** `list_conversations` (full threads, newest first), `get_contact`, `update_contact`, `set_conversation_ai`, `list_quick_answers`, `save_quick_answer`.
- **Numbers and status:** `check_iphones` then `get_iphone_check_results`, `get_message_status`, `list_lines`, `get_balance`, `list_whatsapp_numbers`, `get_whatsapp_status`.

## How to work

1. **Confirm before anything is sent.** Show the exact message and the recipient, or the recipient count for a campaign, and wait for the user's yes. Messages reach real people and can't be unsent.
2. **Scheduled or unattended runs.** When the task runs on a schedule with nobody watching, send only what the user already approved when they set it up: the same kind of message to the same kind of recipient. Anything new (a different message, a new list, a bigger send) waits for the user, so report it as a draft instead.
3. **First message to someone new is a short question, with no link.** For example "Hi Sam, is this still the best number for you?". Send links only after they reply. This protects the user's number from being flagged as spam.
4. **Every `{merge_field}` must exist on every recipient.** If the campaign is refused for a missing field, fix the list or the message; never drop the field silently.
5. **Never try to message people who opted out.** iBlueText removes them automatically. Tell the user who was skipped.
6. **Daily limits are normal.** Each line has a daily cap on new contacts. Messages over it wait and go out later; report them as waiting, don't resend.
7. **Payment needs a person.** If a tool says credits or a line are needed, tell the user to add them at https://ibluetext.com/portal/. The agent can't pay.
8. **Check before a big send.** For a list, run `check_iphones` first so the user knows how many will get iMessage and how many SMS.
9. **Times are in the user's time zone.** Say "sent 2:14pm", not UTC.

## Common requests

- "Text Sam that the order is ready" → find or confirm the number, draft the message, confirm, `send_message`.
- "Who replied today?" / "Who needs a reply?" → `list_conversations`, summarize each thread in one line, offer drafts.
- "Every morning, tell me who replied overnight" → a scheduled check with `list_conversations`; summarize and draft replies, don't send them.
- "Send this to my list" → `check_iphones`, show the split, draft, confirm, `create_campaign`, then `get_campaign` for progress.
- "Stop the campaign" → `pause_or_resume_campaign`.

## No account yet?

The user can start free at https://ibluetext.com with free lookups and trial texts, no card needed. To text from a dedicated number they pick a plan: a fully hosted line with a new number that iBlueText runs for them, or self-hosted on their own Mac and phone. Current prices are on https://ibluetext.com/pricing.php. Help: russ@ibluetext.com.
