---
name: tickets
description: Work the SIT Manager support-ticket queue — read open tickets, investigate the issue in the DB/code, post automated replies, and propose (not silently apply) fixes. Use when the user runs /tickets or asks to handle/answer support tickets.
---

# /tickets — support ticket triage & resolution

Tickets live in `support_tickets` / `support_ticket_replies` (see `lib/support-tickets.ts`).
All reads/writes go through the helper — never hand-write INSERTs into those tables:

```
node scripts/support-tickets.mjs list                 # tickets awaiting support
node scripts/support-tickets.mjs show <id>            # ticket + thread (incl. internal notes)
node scripts/support-tickets.mjs reply <id> <file>    # PUBLIC reply, the raiser sees it
node scripts/support-tickets.mjs note <id> <file>     # INTERNAL note, admins only
node scripts/support-tickets.mjs status <id> <open|in_progress|resolved|closed>
```

Write message text to a file in the session scratchpad and pass the path.
`.env.local` points at the PRODUCTION database — treat every write as live.

## Workflow (per ticket, highest priority first)

1. `list`, then `show <id>`. Read the whole thread, including earlier internal notes — don't redo work or repeat an answer already given.
2. **Investigate.** Find the real cause: query the relevant tables read-only (wrap prod queries in `SET STATEMENT max_statement_time=…`), read the code for the page/API involved, check the project memory notes. Don't guess.
3. **Classify** and act:
   - **Email-sending tickets** (anything about emails/receipts/notifications not being sent or received, email errors, SMTP/SES) → do NOT investigate in the reply. Post exactly this public reply and leave the ticket `in_progress`:
     `Hello,\n\nThank you for letting us know. We will get back to you shortly.\n\n— SIT Support`
     Only once per ticket (skip if this reply is already in the thread). You may add an internal `note` with any finding for the user.
   - **How-to / question / already-fixed / explainable data state** → post a public `reply` that fully answers it. If nothing more is needed, set `resolved`.
   - **Data fix needed** (wrong record, missing row, publish flag…) → post an internal `note` with the finding, the exact SQL, and rows affected. **Ask the user before running any write.** After approval and verifying the result, post a public `reply` saying what was corrected, then `resolved`.
   - **Code bug / feature request** → internal `note` with root cause, files and proposed change. Ask the user before editing code. After the fix is made, public `reply` + `resolved`. Log every code/data change to Software Updates (`node scripts/log-change.mjs`).
   - **Unclear ticket** → public `reply` asking a specific clarifying question (which student/batch/page, what they expected). Leave it `in_progress`.
4. Report a short summary table at the end: ticket, finding, action taken, what awaits approval.

Never change data or code without the user's go-ahead in this session. When running unattended in a loop, only post replies/notes/status; leave fixes listed in the summary for the user. Replies, notes and status changes are allowed automatically.

## Reply rules (public replies — mandatory)

- **Never mention the person's name** — not the raiser's, not a student's, not a staff member's. No greeting with a name ("Hi Harshada"). Refer to records by ID, roll no., batch code or receipt no. instead. Start with "Hello," or go straight to the point.
- **No garbage**: no placeholder text, no raw JSON/SQL/stack traces, no internal table or column names, no guesses presented as facts, no filler. Every sentence must be true and checked.
- **Respectful and very professional** in tone: clear, polite, concise. Say what was found, what was done, and what (if anything) the user should do next. Sign off as "— SIT Support".
- **Simple, non-technical words.** Write for someone who doesn't know software: no jargon (no "database", "API", "server", "cache", "query", "record ID", "bug", "deploy"). Say "the system", "the page", "your batch list". Short sentences.
- Plain text, short paragraphs or a few bullet points; give the exact menu path when explaining how to do something (e.g. "Masters → Notice Board → Add Notice").
- **Exception — the account named Jeena** (ticket `user_name` starting with "Jeena"): the reply may carry a *little* light, good-natured wit — one gentle playful line at most (e.g. "Good news: the system has decided to cooperate again."). It must still be professional and helpful, never mocking, sarcastic about her work, rude, or about anything personal, and the name rule above still applies. When unsure, leave the joke out.

Internal notes may be technical (table names, SQL, file paths) since only admins see them, but still no personal names beyond what's needed to identify a record.
