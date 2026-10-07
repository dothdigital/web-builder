import type Stripe from 'stripe'

const escapeHtml = (value: string) => value.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!))
function template(subject: string, paragraphs: string[], links: { label: string; url: string }[]) {
  const footer = 'Warm regards,\nTeam Webtummy\nYour AI Growth Team\n\nNeed a hand? Email support@webtummy.com.'
  return {
    subject,
    body: [...paragraphs, ...links.map(link => `${link.label}: ${link.url}`), footer].join('\n\n'),
    html: `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${escapeHtml(subject)}</title></head>
<body style="margin:0;padding:0;background:#F8F7FC;color:#14243A;font-family:Arial,Helvetica,sans-serif">
<div style="display:none;max-height:0;overflow:hidden;opacity:0">${escapeHtml(paragraphs[0] ?? subject)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 16px">
<table role="presentation" width="560" cellpadding="0" cellspacing="0" style="width:100%;max-width:560px"><tr><td style="padding:0 0 24px;font-size:25px;font-weight:bold;letter-spacing:-1px"><span style="display:inline-block;padding:7px 12px;margin-right:10px;border-radius:9px;background:#6B4EE6;color:white">w</span>webtummy</td></tr>
<tr><td style="background:white;border:1px solid #E7E5EF;border-radius:20px;padding:32px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="3" style="margin-bottom:24px"><tr>${['#6B4EE6','#E8483A','#E89400','#0E8F82','#2F62E8','#D63384'].map(color => `<td height="6" style="background:${color};border-radius:8px;font-size:0;line-height:0">&nbsp;</td>`).join('')}</tr></table>
<p style="font-size:12px;letter-spacing:1.5px;font-weight:bold;color:#6B4EE6">YOUR AI GROWTH TEAM</p><h1 style="margin:0 0 24px;font-size:28px;line-height:1.2">${escapeHtml(subject)}</h1>
${paragraphs.map(p => `<p style="margin:0 0 18px;font-size:15px;line-height:1.7;color:#3E4A63">${escapeHtml(p)}</p>`).join('')}
${links.map((link, index) => index === 0 ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:24px 0"><tr><td bgcolor="#6B4EE6" style="border-radius:10px"><a href="${escapeHtml(link.url)}" style="display:inline-block;padding:16px 26px;color:white;text-decoration:none;font-size:15px;font-weight:bold">${escapeHtml(link.label)} &rarr;</a></td></tr></table>` : `<p style="font-size:14px;line-height:1.7"><a style="color:#6B4EE6" href="${escapeHtml(link.url)}">${escapeHtml(link.label)}</a></p>`).join('')}
<p style="margin-top:28px;font-size:14px;line-height:1.7">${escapeHtml(footer).replace(/\n/g, '<br>')}</p></td></tr>
<tr><td align="center" style="padding:24px 12px 0;font-size:11px;line-height:1.7;color:#8A93A8">Webtummy · A product of Dot H Digital Inc.<br>Mississauga, Ontario, Canada<br>Design. Build. Optimize. Deploy. Run. Grow.</td></tr></table></td></tr></table></body></html>`,
  }
}

export function welcomeEmail(name: string | null, base: string) {
  return template('Welcome to Webtummy — your email is verified', [
    name?.trim() ? `Hi ${name.trim()},` : 'Hi there,',
    'Your email is verified and your Webtummy account is ready.',
    'Sign in to activate your 7-day free trial by adding a card at secure checkout. Eligible new customers get full access for 7 days, then US$29/month unless they cancel before the trial ends. Already used your trial? Choose a paid subscription to continue.',
  ], [{ label: 'Open Webtummy', url: `${base}/dashboard` }])
}

export function paymentEmail(invoice: Stripe.Invoice, workspaceName: string, base: string, subscriptionActive = false) {
  const amount = new Intl.NumberFormat('en-US', { style: 'currency', currency: invoice.currency.toUpperCase() }).format(invoice.amount_paid / 100)
  const paidAt = invoice.status_transitions.paid_at
  const links = [{ label: 'Manage your plan and payment history', url: `${base}/billing` }]
  if (invoice.hosted_invoice_url) links.unshift({ label: 'View your paid invoice and receipt', url: invoice.hosted_invoice_url })
  if (invoice.invoice_pdf) links.push({ label: 'Download your invoice PDF', url: invoice.invoice_pdf })
  const noCharge = invoice.amount_paid === 0
  return template(noCharge ? 'Your Webtummy subscription is confirmed' : subscriptionActive ? 'Your Webtummy subscription is active — payment received' : 'Webtummy payment received — thank you', [
    noCharge ? `Your subscription for ${workspaceName} is confirmed. Amount paid: ${amount}. No payment was required for this invoice.` : `We received your payment of ${amount} for ${workspaceName}. Thank you!`,
    `Invoice: ${invoice.number || invoice.id}${paidAt ? `. Paid on ${new Date(paidAt * 1000).toLocaleDateString('en-US', { timeZone: 'UTC', year: 'numeric', month: 'long', day: 'numeric' })}.` : '.'}`,
    subscriptionActive ? 'Your subscription is active, giving you full access to the platform. You can manage billing or cancel future renewals from your account at any time.' : 'You can view the payment details using the links below.',
  ], links)
}

export type SubscriptionNoticeKind = 'CANCELLATION' | 'RESUMED' | 'REACTIVATED'
export function subscriptionEmail(kind: SubscriptionNoticeKind, workspaceName: string, periodEnd: Date | null, base: string, paymentOverdue = false, trialing = false) {
  const date = periodEnd?.toLocaleDateString('en-US', { timeZone: 'UTC', dateStyle: 'long' })
  const subject = kind === 'CANCELLATION' ? 'Your Webtummy renewal is cancelled' : kind === 'RESUMED' ? 'Your Webtummy subscription will renew again' : 'Your Webtummy subscription is active again'
  const trialDate = periodEnd?.toLocaleString('en-US', { timeZone: 'UTC', dateStyle: 'long', timeStyle: 'short' })
  const paragraphs = trialing && kind === 'CANCELLATION' ? [
    `Automatic billing after the trial is cancelled for ${workspaceName}.`,
    `Full trial access continues${trialDate ? ` until ${trialDate} UTC` : ' until your trial ends'}. Your card will not be charged for this trial unless you resume before it ends.`,
    'After the trial ends, reactivate through Plans & billing to start a paid subscription. Reactivation does not grant another free trial. Your saved website data is retained for at least 90 days after suspension.',
  ] : trialing && kind === 'RESUMED' ? [
    `Automatic billing after the trial is restored for ${workspaceName}.`,
    `Your original trial still ends${trialDate ? ` on ${trialDate} UTC` : ' on its original date'}. Your saved card will then be billed at US$29/month, subject to any discount shown at checkout.`,
    'No payment was charged for resuming, and the trial has not been extended. Cancel before the trial ends to avoid the first subscription charge.',
  ] : kind === 'CANCELLATION' ? [
    `Renewal is cancelled for ${workspaceName}. Your subscription will not renew.`,
    paymentOverdue ? `Your subscription is scheduled to end${date ? ` on ${date}` : ' at the end of the current period'}. Existing payment restrictions still apply: previously paid customers receive 7 days of full access after a failed renewal, hosting continues through day 30, and hosting may then be suspended.` : date ? `Your current access continues through ${date}. Hosting may be suspended when your subscription ends.` : 'Your access continues through the end of your current paid period. Hosting may be suspended when your subscription ends.',
    'You can resume renewal before the current period ends through Plans & billing. After it ends, use Reactivate subscription to complete checkout again.',
    'Your saved website content and data will be retained for at least 90 days after suspension. We send multiple warnings before any permanent deletion review. Legal holds and required retention take priority.',
  ] : kind === 'RESUMED' ? [
    `Automatic renewal is restored for ${workspaceName}. Your scheduled cancellation has been removed.`,
    date ? `Your next renewal is on ${date}. Your existing billing date, plan, discounts and saved payment details are unchanged.` : 'Your existing billing date, plan, discounts and saved payment details are unchanged.',
    'No new payment was charged for resuming renewal. Stripe will charge the amount due at your next renewal.',
  ] : [
    `Your subscription for ${workspaceName} is active again. Website editing and AI features are available.`,
    'Your retained website content and data are preserved. Previously published hosting will be restored automatically; it may take a few minutes for visitors to see the website again.',
    date ? `Your current subscription period ends on ${date}.` : 'You can view your renewal date and invoices in Plans & billing.',
  ]
  return template(subject, paragraphs, [{ label: 'Manage your subscription', url: `${base}/billing` }])
}

export function trialEmail(workspaceName: string, end: Date, base: string) {
  const date = `${end.toLocaleString('en-US', { timeZone: 'UTC', dateStyle: 'long', timeStyle: 'short' })} UTC`
  return template('Your 7-day Webtummy trial is activated', [
    `Your 7-day free trial is now active, giving you full access to the platform for ${workspaceName}.`,
    `Your trial ends on ${date}. At the end of the 7-day trial, your subscription will automatically begin at US$29/month using the payment method you provided. Any discount shown at checkout applies to the amount due.`,
    'If you cancel before the trial ends, you will not be charged the first subscription payment. You keep full access for the remaining trial period.',
    'Once paid billing has started, you may cancel at any time to prevent future renewals. Cancellation does not automatically refund any subscription charge that has already been processed.',
    'You can manage or cancel your subscription from your account at any time.',
  ], [{ label: 'Open your dashboard', url: `${base}/dashboard` }, { label: 'Manage or cancel your subscription', url: `${base}/billing` }])
}
