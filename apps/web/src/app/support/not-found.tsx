import Link from 'next/link'
export default function MissingGuide(){return <div style={{maxWidth:700,margin:'100px auto',padding:24}}><h1>We couldn’t find that guide.</h1><p>Browse the help center to find the instructions you need.</p><Link href="/support">Browse all guides →</Link></div>}
