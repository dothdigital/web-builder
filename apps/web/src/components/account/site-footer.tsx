import Link from 'next/link'

export function SiteFooter() {
  return (
    <footer className="wt-site-footer">
      <p>© {new Date().getUTCFullYear()} Webtummy · DotH digital Inc.</p>
      <nav aria-label="Legal and contact">
        <Link href="/privacy">Privacy Policy</Link>
        <Link href="/terms">Terms of Use</Link>
        <Link href="/contact">Contact Us</Link>
      </nav>
    </footer>
  )
}
