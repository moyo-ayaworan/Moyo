# Studio email

The default studio contact, support, reply and notification address is `moyoayaworan@gmail.com`. The live contact row (`contact.id=1`) and the CONTACT_EMAIL / SMTP_REPLY_TO settings use the same address. Customer/account email identities are independent of the studio contact setting.

For outgoing mail, set `MOYO_GMAIL_APP_PASSWORD` in Vercel Production to the Gmail app password belonging to that account. The existing protected `OYO_GMAIL_APP_PASSWORD` setting is accepted as a compatibility alias; its value stays server-only. Keep it in server environment configuration, never a NEXT_PUBLIC variable, client code, source file or chat. Google requires 2-Step Verification before app-password creation. Environment changes require a new deployment.

The Node server's instrumentation register calls `applyStudioMailEnvironment` before serving requests. A valid new credential switches all legacy SMTP user/password/from aliases to the new Gmail account together, with smtp.gmail.com over TLS on port 465. Account verification/reset, bookings/reminders/recovery, artwork inquiries, documents, newsletter, payment and operational mail use those existing transports. Until a new credential is available, existing SMTP authentication remains intact; customer replies use the new contact address.

The independent private moyo-operations monitor reads its own GitHub SMTP_USER / SMTP_PASS and OPERATIONS_ALERT_TO secrets. These must match the chosen sender and inbox separately from Vercel. Do not trigger an alert/test message without owner authorization.

Validation: website tests include no-credential fallback and the coordinated credential switch. Mail setup checks verify SMTP authentication without sending. The owner separately authorized one setup test to the same Gmail inbox; record SMTP acceptance without treating it as proof that the owner has read the message.

The desktop support address is updated in the development app. Already-published Mac ZIPs are immutable; the new visible address ships in the next requested app release. App account emails are handled by the live website and use its configured sender.

The private `/api/admin/email-test` endpoint requires the admin session and same-origin protection. GET reports only whether the sender is configured; POST verifies SMTP and sends a clearly labelled test only to the fixed studio address, with a shared rate limit. It accepts no arbitrary recipient and never returns credentials.
