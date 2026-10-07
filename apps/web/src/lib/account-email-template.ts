type AccountEmailInput = {
  purpose: 'verify' | 'reset'
  name?: string | null
  url: string
}

const escapeHtml = (value: string) => value.replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]!))

export function accountEmailTemplate({ purpose, name, url }: AccountEmailInput) {
  const verifying = purpose === 'verify'
  const subject = verifying ? 'Welcome to Webtummy — verify your email' : 'Reset your Webtummy password'
  const heading = verifying ? 'Your next chapter starts here.' : 'Let’s get you back in.'
  const greeting = name?.trim() ? `Hi ${name.trim()},` : 'Hi there,'
  const introduction = verifying
    ? 'Welcome to Webtummy. Your business idea is the beginning — your AI Growth Team helps with the rest.'
    : 'We received a request to set a new password for your Webtummy account.'
  const instruction = verifying
    ? 'Confirm your email address below. You’ll then see an “Email verified” page, where you can sign in to continue.'
    : 'Use the button below to choose a new password. Updating it will sign out your previous sessions.'
  const button = verifying ? 'Verify my email' : 'Set a new password'
  const nextStep = verifying ? 'After signing in, eligible new customers can activate a 7-day free trial with full access by adding a card at secure checkout. Your subscription then continues at US$29/month unless you cancel before the trial ends. One website. One trial per customer.' : ''
  const ignored = verifying
    ? 'If you didn’t create a Webtummy account, you can safely ignore this email.'
    : 'If you didn’t request a password change, ignore this email. Your password will stay the same.'
  const text = [greeting, introduction, instruction, `${button}: ${url}`, 'For your security, this link expires in one hour and can be used once.', nextStep, ignored, 'Need a hand? Email support@webtummy.com.', 'Warm regards,\nTeam Webtummy\nYour AI Growth Team', 'Webtummy is a product of Dot H Digital Inc.\nMississauga, Ontario, Canada'].filter(Boolean).join('\n\n')
  const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${escapeHtml(subject)}</title></head>
<body style="margin:0;padding:0;background:#F8F7FC;color:#14243A;font-family:Arial,Helvetica,sans-serif">
<div style="display:none;max-height:0;overflow:hidden;opacity:0">${escapeHtml(verifying ? 'Verify your email, sign in, and meet your AI Growth Team.' : 'Your secure password-reset link is inside.')}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F8F7FC"><tr><td align="center" style="padding:32px 16px">
<table role="presentation" width="560" cellpadding="0" cellspacing="0" style="width:100%;max-width:560px"><tr><td style="padding:0 0 24px;font-size:25px;font-weight:bold;letter-spacing:-1px"><span style="display:inline-block;padding:7px 12px;margin-right:10px;border-radius:9px;background:#6B4EE6;color:#fff">w</span>webtummy</td></tr>
<tr><td style="background:#fff;border:1px solid #E7E5EF;border-radius:20px;padding:32px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="3" style="margin-bottom:24px"><tr>${['#6B4EE6','#E8483A','#E89400','#0E8F82','#2F62E8','#D63384'].map(color => `<td height="6" style="background:${color};border-radius:8px;font-size:0;line-height:0">&nbsp;</td>`).join('')}</tr></table>
<p style="margin:0 0 12px;font-size:12px;font-weight:bold;letter-spacing:1.5px;color:#6B4EE6">${verifying ? 'WELCOME TO WEBTUMMY' : 'ACCOUNT SECURITY'}</p>
<h1 style="margin:0 0 24px;font-size:30px;line-height:1.2;letter-spacing:-1px">${escapeHtml(heading)}</h1>
<p style="margin:0 0 16px;font-size:16px;font-weight:bold">${escapeHtml(greeting)}</p>
<p style="margin:0 0 16px;font-size:15px;line-height:1.7;color:#3E4A63">${escapeHtml(introduction)}</p>
<p style="margin:0 0 24px;font-size:15px;line-height:1.7;color:#3E4A63">${escapeHtml(instruction)}</p>
<table role="presentation" cellpadding="0" cellspacing="0"><tr><td bgcolor="#6B4EE6" style="border-radius:10px"><a href="${escapeHtml(url)}" style="display:inline-block;padding:16px 26px;border:1px solid #6B4EE6;border-radius:10px;color:#fff;text-decoration:none;font-size:16px;font-weight:bold">${escapeHtml(button)} &rarr;</a></td></tr></table>
<p style="margin:16px 0 24px;font-size:12px;line-height:1.6;color:#55607A">For your security, this link expires in one hour and can be used once.</p>
${nextStep ? `<div style="padding:16px 18px;background:#F8F7FC;border-radius:12px;margin-bottom:24px;font-size:13px;line-height:1.7;color:#55607A">${escapeHtml(nextStep)}</div>` : ''}
<p style="margin:0 0 8px;font-size:12px;line-height:1.6;color:#55607A">Button not working? Copy this link into your browser:</p>
<p style="margin:0 0 24px;font-size:12px;line-height:1.6;word-break:break-all"><a href="${escapeHtml(url)}" style="color:#6B4EE6">${escapeHtml(url)}</a></p>
<p style="margin:0 0 24px;font-size:13px;line-height:1.7;color:#55607A">${escapeHtml(ignored)}</p>
<p style="margin:0 0 24px;font-size:13px;line-height:1.7;color:#55607A">Need a hand? <a href="mailto:support@webtummy.com" style="color:#6B4EE6">support@webtummy.com</a></p>
<p style="margin:0;font-size:14px;line-height:1.7">Warm regards,<br><strong>Team Webtummy</strong><br><span style="color:#55607A">Your AI Growth Team</span></p>
</td></tr><tr><td align="center" style="padding:24px 12px 0;font-size:11px;line-height:1.7;color:#8A93A8">Webtummy · A product of Dot H Digital Inc.<br>Mississauga, Ontario, Canada<br>Design. Build. Optimize. Deploy. Run. Grow.</td></tr></table>
</td></tr></table></body></html>`
  return { subject, text, html }
}
