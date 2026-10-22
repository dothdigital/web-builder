import type { ReactNode } from 'react'

// Match imported header container breakpoints without importing its typography
// or section rules into native content components.
export function SiteContentContainer({theme,children}:{theme?:string;children:ReactNode}) {
  return <>
    <style>{`.awb-site-content{width:100%;max-width:var(--awb-max-width);margin:0 auto;padding:0 24px;box-sizing:border-box}.awb-site-content[data-template-theme="webtummy-business"]{max-width:none;padding:0 7.5px}.awb-site-content[data-template-theme="webtummy-insurance"]{max-width:none;padding:0 12px}@media(min-width:576px){.awb-site-content[data-template-theme]{max-width:540px}}@media(min-width:768px){.awb-site-content[data-template-theme]{max-width:720px}}@media(min-width:992px){.awb-site-content[data-template-theme]{max-width:960px}}@media(min-width:1200px){.awb-site-content[data-template-theme]{max-width:1140px}}@media(min-width:1400px){.awb-site-content[data-template-theme="webtummy-business"]{max-width:1305px}.awb-site-content[data-template-theme="webtummy-insurance"]{max-width:1320px}}`}</style>
    <div className="awb-site-content" data-template-theme={theme}>{children}</div>
  </>
}
