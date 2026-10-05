import Link from 'next/link'
import { ErrorNotice } from '@/components/error-notice'
import { paymentHistory, requireBillingAccess } from '@/lib/billing/history'

export async function PaymentHistory({ workspaceId, after, basePath }: { workspaceId: string; after?: string; basePath: string }) {
  await requireBillingAccess(workspaceId)
  let history
  try { history = await paymentHistory(workspaceId, after) }
  catch { return <section className="wt-card mt-6"><h2>Payment history</h2><ErrorNotice code="WT-BILLING-002" message="Payment history could not load. Refresh this page to try again." /></section> }
  const money = (value: number, currency: string) => new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(value / 100)
  return <section className="wt-card mt-6"><div className="wt-section-title"><h2>Payment history</h2>{after && <Link href={basePath}>Latest payments →</Link>}</div><p className="wt-muted">Your subscription invoices, payment status and downloadable records.</p>
    {history.data.length ? <div className="wt-table-wrap"><table className="wt-table"><thead><tr><th>Date</th><th>Invoice</th><th>Total</th><th>Paid</th><th>Status</th><th>Download</th></tr></thead><tbody>{history.data.map(invoice => <tr key={invoice.id}><td>{new Date(invoice.created * 1000).toLocaleDateString('en-US', { timeZone: 'UTC' })}</td><td>{invoice.number ?? 'Pending invoice'}</td><td>{money(invoice.total, invoice.currency)}</td><td>{money(invoice.amount_paid, invoice.currency)}</td><td><span className="wt-badge">{invoice.status === 'open' ? 'Payment pending' : invoice.status === 'uncollectible' ? 'Unpaid' : invoice.status ?? 'Pending'}</span></td><td>{invoice.invoice_pdf ? <a href={`/api/billing/invoices/${encodeURIComponent(invoice.id)}?workspaceId=${encodeURIComponent(workspaceId)}`} target="_blank" rel="noopener noreferrer">Download invoice PDF ↓</a> : <span className="wt-muted">Available after invoice finalization</span>}</td></tr>)}</tbody></table></div> : <p className="wt-muted mt-4">{after ? 'No older payments.' : 'No payment transactions yet. Your invoices will appear here after subscribing.'}</p>}
    {history.has_more && history.data.length > 0 && <div className="wt-pagination"><Link href={`${basePath}?after=${encodeURIComponent(history.data[history.data.length - 1]!.id)}`}>Older payments →</Link></div>}
  </section>
}
