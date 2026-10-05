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
              <a className={styles.s383} href="mailto:info@dothdigital.com">
                {"info@dothdigital.com"}
              </a>
            </div>
            <div className={styles.s381}>
              <span className={styles.s382}>
                {"Office"}
              </span>
              <a className={styles.s383} href="https://maps.google.com/?q=2233+Argentia+Rd+Mississauga">
                {"302 East Tower, 2233 Argentia Rd, Mississauga, ON L5N 6A6"}
              </a>
            </div>
            <div className={styles.s384}>
              <span className={styles.s382}>
                {"Follow us"}
              </span>
              <div className={styles.s207}>
                <a className={styles.s385} href="https://www.facebook.com/dothdigital" target="_blank" aria-label="Facebook" rel="noopener noreferrer">
                  <svg width="19" height="19" viewBox="0 0 24 24">
                    <path fill="currentColor" d="M14 8h3V4h-3c-2.8 0-4.5 1.7-4.5 4.6V11H7v4h2.5v9h4v-9H17l.5-4h-4V8.9c0-.6.3-.9.5-.9z">
                    </path>
                  </svg>
                </a>
                <a className={styles.s386} href="https://twitter.com/dothdigital1?lang=en" target="_blank" aria-label="X" rel="noopener noreferrer">
                  <svg width="19" height="19" viewBox="0 0 24 24">
                    <path fill="currentColor" d="M17.8 3h3.1l-6.8 7.8L22 21h-6.2l-4.9-6.4L5.3 21H2.2l7.3-8.3L2 3h6.4l4.4 5.8L17.8 3zm-1.1 16.2h1.7L7.4 4.7H5.6l11.1 14.5z">
                    </path>
                  </svg>
                </a>
                <a className={styles.s387} href="https://www.instagram.com/dothdigital/" target="_blank" aria-label="Instagram" rel="noopener noreferrer">
                  <svg width="19" height="19" viewBox="0 0 24 24">
                    <rect x="3" y="3" width="18" height="18" rx="5" fill="none" stroke="currentColor" strokeWidth="2">
                    </rect>
                    <circle cx="12" cy="12" r="4" fill="none" stroke="currentColor" strokeWidth="2">
                    </circle>
                    <circle cx="17.5" cy="6.5" r="1.2" fill="currentColor">
                    </circle>
                  </svg>
                </a>
                <a className={styles.s388} href="https://www.linkedin.com/company/dothdigital/" target="_blank" aria-label="LinkedIn" rel="noopener noreferrer">
                  <svg width="19" height="19" viewBox="0 0 24 24">
                    <path fill="currentColor" d="M4.98 3.5a2.5 2.5 0 110 5 2.5 2.5 0 010-5zM3 9h4v12H3zM9 9h3.8v1.7h.1c.5-1 1.8-2 3.8-2 4 0 4.8 2.6 4.8 6V21h-4v-5.6c0-1.3 0-3-1.9-3s-2.1 1.4-2.1 2.9V21H9z">
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
