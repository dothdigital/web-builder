// Adapted from About-Us.dc.html in the uploaded Webtummy.zip.
import Link from 'next/link'
import styles from './marketing.module.css'

export function MarketingAboutUs() {
  return (
    <>
    <div data-screen-label="About us">
      <section className={styles.s1}>
        <div className={styles.s315}>
          <div className={styles.s39}>
            <div className={styles.s168}>
              {"About us"}
            </div>
            <h1 className={styles.s316}>
              {"Built by a team that has spent years building for businesses."}
            </h1>
          </div>
          <div className={styles.s317}>
            <p className={styles.s43}>
              {"Webtummy brings website creation, management and hosting together in one platform, built by a team with experience in software, automation, AI and digital growth."}
            </p>
            <p className={styles.s43}>
              {"We saw the same problem across every industry: getting online meant stitching together builders, designers, developers, hosting, SEO tools and content. Webtummy puts that whole team into one platform."}
            </p>
          </div>
        </div>
      </section>
      <section className={styles.s166}>
        <div className={styles.s167}>
          <h2 className={styles.s320}>
            {"Software and digital systems built to improve operations, conversion and growth."}
          </h2>
          <p className={styles.s62}>
            {"Our team helps businesses operate better, sell smarter and scale with less friction. The focus is implementation, not just strategy — building, improving, integrating and deploying practical solutions that move a business forward."}
          </p>
          <p className={styles.s62}>
            {"Recent work spans manufacturing, ecommerce, professional services and operations-heavy teams. Webtummy brings that experience to every small business, entrepreneur and agency."}
          </p>
        </div>
        <div className={styles.s321}>
          <div className={styles.s322}>
            <div className={styles.s323}>
              {"Websites & Ecommerce"}
            </div>
            <div className={styles.s324}>
              {"High-performance sites and stores built for speed, clarity and lead generation."}
            </div>
          </div>
          <div className={styles.s325}>
            <div className={styles.s326}>
              {"Custom Software"}
            </div>
            <div className={styles.s324}>
              {"Internal tools, portals and integrations built around your workflow."}
            </div>
          </div>
          <div className={styles.s327}>
            <div className={styles.s328}>
              {"Mobile Apps"}
            </div>
            <div className={styles.s324}>
              {"iOS and Android apps designed for usability, performance and scale."}
            </div>
          </div>
          <div className={styles.s329}>
            <div className={styles.s330}>
              {"ERP & Business Central"}
            </div>
            <div className={styles.s324}>
              {"Implementation and optimization to streamline operations and reporting."}
            </div>
          </div>
          <div className={styles.s331}>
            <div className={styles.s332}>
              {"CRM & Automation"}
            </div>
            <div className={styles.s324}>
              {"Pipelines, routing, follow-ups and reporting to keep teams aligned."}
            </div>
          </div>
          <div className={styles.s333}>
            <div className={styles.s334}>
              {"Artificial Intelligence"}
            </div>
            <div className={styles.s324}>
              {"Practical AI capabilities that improve efficiency and decision-making."}
            </div>
          </div>
        </div>
      </section>
      <section className={styles.s351}>
        <div className={styles.s352}>
          <h2 className={styles.s353}>
            {"A proven process that keeps projects on track."}
          </h2>
          <p className={styles.s354}>
            {"A step-by-step delivery model shapes how Webtummy is built and supported."}
          </p>
        </div>
        <div className={styles.s355}>
          <div className={styles.s356}>
            <span className={styles.s357}>
              {"1"}
            </span>
            <div className={styles.s65}>
              {"Discovery & Planning"}
            </div>
            <div className={styles.s358}>
              {"Understand business needs and craft a tailored roadmap."}
            </div>
          </div>
          <div className={styles.s359}>
            <span className={styles.s360}>
              {"2"}
            </span>
            <div className={styles.s65}>
              {"Solution Design"}
            </div>
            <div className={styles.s358}>
              {"Develop a custom solution aligned with your workflows."}
            </div>
          </div>
          <div className={styles.s361}>
            <span className={styles.s362}>
              {"3"}
            </span>
            <div className={styles.s65}>
              {"Configuration & Integration"}
            </div>
            <div className={styles.s358}>
              {"Adapt and integrate the system for seamless operation."}
            </div>
          </div>
          <div className={styles.s363}>
            <span className={styles.s364}>
              {"4"}
            </span>
            <div className={styles.s65}>
              {"Training & Go-Live"}
            </div>
            <div className={styles.s358}>
              {"Equip your team and ensure a smooth transition."}
            </div>
          </div>
          <div className={styles.s365}>
            <span className={styles.s366}>
              {"5"}
            </span>
            <div className={styles.s65}>
              {"Ongoing Support"}
            </div>
            <div className={styles.s358}>
              {"Continuous optimization and scalability as you grow."}
            </div>
          </div>
        </div>
      </section>
      <section className={styles.s373}>
        <div className={styles.s374}>
          <h2 className={styles.s103}>Let’s build your online presence.</h2>
        </div>
        <div className={styles.s264}>
          <Link className={styles.s376} href="/contact">Get in touch</Link>
        </div>
      </section>
    </div>
    </>
  )
}
