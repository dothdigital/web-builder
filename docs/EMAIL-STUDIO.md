# Admin email studio

Open `/admin/emails` from the Admin sidebar. Only platform administrators can read or change campaigns, sequences, settings or delivery records. Each administrative mutation checks authentication and role on the server and records an audit event.

## First-login sequence

The successful sign-in callback records a user's first login exactly once. Sign-up can collect optional promotional consent; users can change it under `/account`. Google/Microsoft users can opt in there after signing in. Login is not itself consent and existing users are not silently subscribed.

Seeded messages have separate website-created and no-website branches on days 0, 2, 5 and 7. Day-7 messages repeat every 7 days. Admin can edit the subject, body, day delay, repetition (0 for once, otherwise at least 7 days), website condition and enabled state. Existing messages open as text blocks in the visual editor. Click **Design email** to edit text, headings, images, linked buttons, dividers and spacers. Select words for bold, italic, underline, font, size, colour or hyperlinks; block controls handle alignment, background, padding and image width. Upload local images or supply an HTTPS image URL. Drag the ⠿ handle in the content list or on the canvas to reorder blocks; a purple insertion line indicates the target. Arrow controls, duplication and deletion are also available. Desktop/mobile previews use the same HTML renderer as the worker. Close with Done, then save the step or campaign draft to persist the design. Saved visual designs send HTML plus an automatically derived text alternative; untouched older messages continue to send plain text. Supported placeholders are listed in the editor. Unsubscribe links and the configured business address are appended automatically.

Timing is elapsed 24-hour days from first login, not from each login. The worker chooses the most recent due step matching the user's current website status. It does not send a backlog after downtime. Once an occurrence has a delivery record, it is not queued again. At most one automated reminder goes to a user per 24 hours. Overlapping same-day steps with the same condition resolve deterministically by step ID; prefer distinct days/conditions. A payment recorded by the Stripe webhook permanently ends onboarding for workspace owners. The worker also checks payment before dispatch and again at send time. Existing paid users are excluded even before the conversion marker is set.

## Campaigns

1. Create a draft, select paid, all unpaid, active-trial or expired-trial recipients, and optionally filter by whether a website exists.
2. Save the draft to see a message preview and current eligible recipient count.
3. Review the message and audience and explicitly queue it. No email is sent merely by editing or previewing.
4. Refresh campaign progress to see pending, sent, skipped, failed or unknown counts. Cancel stops remaining queued emails; an in-flight email may complete.

Recipients are opted-in, verified/non-suspended users who own at least one active workspace. Complimentary workspaces are excluded. A user with any active paid workspace belongs to the paid audience, even if another workspace is unpaid. A campaign sends once per user. Users who opt out or change eligibility while waiting are skipped. Contacts created after queuing are excluded; eligibility for existing contacts is evaluated as the batch expands and again at delivery. Counts in the preview are estimates at that moment, not a frozen guarantee.

Queued campaigns are immutable; use a new draft for different content. Sequence edits affect pending and future emails. Turning delivery off pauses all promotional sends. Turning automation off pauses only the sequence; campaigns can continue.

## Worker and SES

Run the existing `@awb/worker` process with `USE_REDIS_QUEUE=true`. Every 15 seconds it dispatches up to 200 sequence contacts and 200 campaign contacts, using durable cursors. Delivery handles up to 5 messages per sweep, separately from AI requests. PostgreSQL advisory locks coordinate multiple worker processes; delivery is serialized and paced at no more than approximately one message per second. An admin daily budget defaults to 500 promotional messages per UTC day. This budget does not count password/security/content-ready messages. This is a conservative starting rate, not a claim of load-tested 1,000-user throughput.

Required existing configuration: `SES_MAILER_FROM`, `SES_MAILER_AWS_REGION`, SES credentials or an IAM role, and `PUBLIC_APP_URL` or `AUTH_URL` pointing to the public application. Production requires HTTPS. Optional `SES_MARKETING_CONFIGURATION_SET` associates messages with an existing SES configuration set. SES account/sender verification, sandbox restrictions and account quotas still apply. Configure SES bounce/complaint monitoring and account-level suppression in AWS; this change does not provision AWS resources or implement an SES feedback webhook. “Sent” means SES accepted the message, not confirmed inbox delivery. Open and click tracking are not implemented.

Known explicit SES throttling responses retry with exponential backoff, up to five attempts. Permanent rejections are marked failed. Timeouts and worker crashes after sending are marked unknown instead of automatically risking duplicate delivery; check SES before preparing a replacement campaign. Each recipient's delivery state is committed before the provider call, independently of the sending lock transaction.

Every promotional email includes a browser unsubscribe link and RFC 8058 one-click unsubscribe headers. GET requests show a confirmation page; POST to the one-click endpoint opts out using an opaque per-user token. No sign-in is needed, and the token cannot opt someone back in. Account/security and content-completion email delivery is separate.

## Enable after review

Delivery and automation start paused. Review the seeded messages, enter your business mailing address, choose the daily limit, then enable the desired switches in Email settings. No real marketing email was sent while implementing or validating this feature. Existing `.env` credentials were not changed.

Validation: `node --import tsx scripts/validate-marketing.mts` uses disposable database records, isolated settings and a mocked SES client; it does not enable the real sender. `scripts/validate-account-http.mts` verifies the actual local sign-in and unsubscribe endpoints with a disposable account. App/worker typechecks and web lint cover the new screens and background code.

## Visual email implementation notes

Designs use validated structured blocks, conservative inline styles and table-based outer email layout. Rich text is sanitised on save and again during rendering, template substitutions are escaped, and unsupported URL schemes are rejected. The mailing address and unsubscribe footer are always appended. Standard email-safe fonts are provided; recipient email apps may substitute fonts and render some spacing differently. There is no promise of pixel-identical rendering across all mail clients.

Images are uploaded through an admin-only endpoint, resized to at most 1200px wide and stored as PNG under a dedicated marketing prefix. Uploads accept JPEG, PNG, WebP and GIF (a static frame), up to 8MB and 25 megapixels. Opaque public image URLs resolve through the app to local storage or fresh signed S3 URLs, without exposing private project images. For real recipients to see images, the app and storage must be reachable publicly; localhost images only work locally. Uploaded images remain stored if their block is removed so already-sent emails do not break.

Additional checks: `scripts/validate-email-design.mts` covers rendering and HTML/URL safety; `scripts/validate-email-designer-ui.mts` exercises the interactive designer in jsdom (including text selection, image upload, drag/drop and submitted design state). Provider calls remain mocked during tests.

## Social icons

Use **Add content → Social icons** to insert Facebook, Instagram, LinkedIn, X, YouTube, TikTok and WhatsApp together. The properties panel edits each profile URL and individual colour, removes icons, and restores missing platforms without overwriting existing links. **All icons colour** applies one colour to the entire row and clears individual overrides. Icon size, spacing, alignment and block background are editable.

All selected icons remain visible in the editing canvas, including blank profiles, so they are easy to configure. Only profiles with links appear in the actual preview, sent HTML and plain-text alternative. The email renderer uses public PNG icons from a fixed, validated endpoint; it does not rely on inline SVG support in email clients. These image URLs need the publicly accessible application domain when sending live emails. Social blocks are saved inside the existing design JSON, so this addition requires no database migration.

## Full HTML option

Inside **Design email**, choose **HTML** beside **Visual**. Paste or edit an entire HTML document (up to 150,000 characters), then use Preview email for desktop/mobile preview. **Start from visual design** generates HTML with personalisation placeholders preserved and without the automatic footer. The visual blocks and HTML source are retained separately; switching modes restores each draft rather than attempting to convert arbitrary HTML into blocks. The active mode is what is saved and sent. Click Done, then Save step or Save draft.

The renderer sanitises full documents, keeps email tables and public image links, inlines embedded CSS with Juice, and retains permitted responsive media rules. It never fetches remote stylesheets or other resources during processing. Scripts, forms, frames, SVG/VML, external stylesheets, web-font rules and CSS URL backgrounds are not supported; use public HTTPS PNG/JPEG image elements and email-safe styling. HTML may therefore differ from the original document or between recipient mail clients.

A mailing-address/unsubscribe footer is appended automatically, and a plain-text alternative is derived from the HTML, including link destinations. All existing audience, consent, payment-stop and delivery controls apply unchanged. Imported HTML is edited as source, not as draggable individual blocks. No database migration is needed: mode and source live in the existing design JSON.
