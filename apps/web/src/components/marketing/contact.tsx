// Adapted from Contact.dc.html in the uploaded Webtummy.zip.
import Link from 'next/link'
import styles from './marketing.module.css'
import { MarketingContactForm } from './contact-form'

export function MarketingContact() {
  return (
    <>
    <div data-screen-label="Contact">
      <section className={styles.s378}>
        <div className={styles.s39}>
          <div className={styles.s168}>
            {"Contact us"}
          </div>
          <h1 className={styles.s379}>
            {"Talk to a real person on the team."}
          </h1>
          <p className={styles.s170}>
            {"Questions about the Individual plan, getting started, migrating an existing website or your Webtummy account — send a message and we’ll get back to you."}
          </p>
          <div className={styles.s380}>
            <div className={styles.s381}>
              <span className={styles.s382}>
                {"Email"}
              </span>
              <a className={styles.s383} href="mailto:info@webtummy.com">
                {"info@webtummy.com"}
              </a>
            </div>
            <div className={styles.s384}>
              <span className={styles.s382}>
                {"Follow us"}
              </span>
              <div className={styles.s207}>
                <a className={styles.s385} href="https://www.facebook.com/webtummy" target="_blank" aria-label="Facebook" rel="noopener noreferrer">
                  <svg width="19" height="19" viewBox="0 0 24 24">
                    <path fill="currentColor" d="M14 8h3V4h-3c-2.8 0-4.5 1.7-4.5 4.6V11H7v4h2.5v9h4v-9H17l.5-4h-4V8.9c0-.6.3-.9.5-.9z">
                    </path>
                  </svg>
                </a>
              </div>
            </div>
          </div>
        </div>
        <div className={styles.s389}>
          <MarketingContactForm />
        </div>
      </section>
    </div>
    </>
  )
}
