import Link from "next/link";
import { GlassWordScene } from "@/components/GlassWordScene";
import HimanshuProfileCard from "@/components/profile/HimanshuProfileCard";
import { HomeRuntime } from "@/components/portfolio/HomeRuntime";
import { ProjectMedia } from "@/components/portfolio/ProjectMedia";
import { capabilities, certificates, profile, projects } from "@/lib/portfolio";
import styles from "./HomePage.module.css";

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "Person",
  name: profile.name,
  jobTitle: profile.role,
  email: `mailto:${profile.email}`,
  sameAs: [profile.github, profile.linkedin],
  alumniOf: {
    "@type": "CollegeOrUniversity",
    name: "Lovely Professional University",
  },
  knowsAbout: ["Software engineering", "Agentic AI engineering", "Data science", "Applied machine learning"],
};

export default function HomePage() {
  return (
    <HomeRuntime>
      <main className={styles.home} id="main-content">
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
        <section className={`${styles.studioHero} ${styles.kineticHero}`} aria-labelledby="hero-title" data-v8-hero>
          <GlassWordScene />
          <div className={styles.kineticGrid} aria-hidden="true" />

          <div className={styles.studioHeroMeta}>
            <p><strong>Software &amp;</strong><br />AI Engineering</p>
            <p>Thinking in systems.<br />Shipping with care.</p>
            <p>
              I&apos;m Himanshu Kumar. I build agentic developer tools, dependable products,
              and applied-ML interfaces.
            </p>
          </div>

          <div className={styles.studioHeroClaim}>
            <p>Software engineer · India · 2026</p>
            <h1 id="hero-title">I build software<br />with craft &amp; proof.</h1>
            <a data-primary-action href="#work">Selected work <span aria-hidden="true">↓</span></a>
          </div>

          <span className={styles.studioHeroCoordinates} aria-hidden="true">Systems / software / AI</span>
        </section>

        <section className={styles.about} id="about" aria-labelledby="about-title">
          <div className={`${styles.sectionFrame} ${styles.aboutGrid}`}>
            <div className={styles.profileCardWrap}>
              <HimanshuProfileCard
                behindGlowEnabled
                showIconPattern={false}
                showUserInfo
              />
            </div>

            <div className={styles.aboutCopy}>
              <p className={styles.kicker}><span>01</span> About</p>
              <h2 id="about-title">I work across software, AI agents, and data.</h2>
              <div className={styles.aboutLead}>
                <p>
                  I&apos;m Himanshu Kumar, a software engineer who likes taking a product from an unclear problem to a
                  working interface, dependable system rules, and tested behavior.
                </p>
                <p>
                  My projects include a coding-agent workflow, an inventory application, and an educational
                  credit-risk tool. Each one shows the real interface, the engineering choices, and the limits of the result.
                </p>
              </div>
            </div>

            <div className={styles.practiceList} aria-label="Areas of practice">
              {capabilities.map((capability, index) => (
                <article className={styles.practiceRow} key={capability.title}>
                  <span>{String(index + 1).padStart(2, "0")}</span>
                  <h3>{capability.title}</h3>
                  <p>{capability.copy}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className={styles.work} id="work" aria-labelledby="work-title">
          <div className={styles.sectionFrame}>
            <header className={styles.workHeader}>
              <div>
                <p className={styles.kicker}><span>02</span> Selected work · 2025–2026</p>
                <h2 id="work-title">Products with a visible job to do.</h2>
              </div>
              <p>
                Three real builds: an agent workflow, an inventory system, and an explained machine-learning app.
                Open a case study for the decisions and verification behind each one.
              </p>
            </header>

            <div className={styles.projectGrid}>
              {projects.map((project, index) => (
                  <article
                    className={`${styles.projectCard} ${index === 0 ? styles.projectLead : ""}`}
                    data-project-card
                    key={project.slug}
                  >
                    <Link
                      aria-label={`Read the ${project.title} case study`}
                      className={styles.mediaLink}
                      data-project-action
                      href={`/work/${project.slug}`}
                    >
                      <ProjectMedia
                        alt={project.imageAlt}
                        primary={project.image}
                        priority={index === 0}
                        sizes={index === 0
                          ? "(max-width: 760px) 100vw, 72vw"
                          : "(max-width: 760px) 100vw, 46vw"}
                      />
                      <span className={styles.projectNumber} aria-hidden="true">{project.number}</span>
                    </Link>

                    <div className={styles.projectCopy}>
                      <p className={styles.projectMeta}>
                        <span>{project.category}</span>
                        <span>{project.date}</span>
                      </p>
                      <h3>{project.title}</h3>
                      <p>{project.strapline}</p>
                      <p className={styles.projectStack}>{project.stack.join(" · ")}</p>
                      <div className={styles.projectLinks}>
                        <Link className={styles.projectAction} data-project-action href={`/work/${project.slug}`}>
                          Read case study <span aria-hidden="true">↗</span>
                        </Link>
                        {project.repository ? (
                          <a
                            className={styles.projectAction}
                            data-project-action
                            href={project.repository}
                            rel="noreferrer"
                            target="_blank"
                          >
                            GitHub <span aria-hidden="true">↗</span>
                            <span className="srOnly"> (opens in a new tab)</span>
                          </a>
                        ) : null}
                      </div>
                    </div>
                  </article>
              ))}
            </div>
          </div>
        </section>

        <section className={styles.experience} id="experience" aria-labelledby="experience-title">
          <div className={`${styles.sectionFrame} ${styles.experienceGrid}`}>
            <div>
              <p className={styles.kicker}><span>03</span> Experience · 2026</p>
              <h2 id="experience-title">AI tools for embedded engineering.</h2>
              <div className={styles.roleCard}>
                <strong>Software Developer · Enlab</strong>
                <span>Agentic AI · Embedded tooling · System design</span>
              </div>
              <p className={styles.experienceIntro}>
                I worked on software that helps an AI assistant understand embedded projects and support setup,
                code generation, building, flashing, and debugging.
              </p>
              <ul className={styles.experiencePoints}>
                <li>Parsed projects from STM32Cube, PlatformIO, Arduino, ESP-IDF, and Zephyr.</li>
                <li>Structured board, framework, dependency, build, flash, and debug settings for the assistant.</li>
                <li>Built PCB helpers for component selection and pin, footprint, and manufacturer checks.</li>
              </ul>
            </div>

          </div>
        </section>

        <section className={styles.certifications} id="certifications" aria-labelledby="certifications-title">
          <div className={styles.sectionFrame}>
            <header className={styles.certificateHeader}>
              <div>
                <p className={styles.kicker}><span>04</span> Certifications · 2024–2025</p>
                <h2 id="certifications-title">Certifications</h2>
              </div>
              <p>
                Verified coursework across agentic AI, machine learning, data tools, and algorithms.
                Each entry links to the original certificate.
              </p>
            </header>

            <div className={styles.certificateLedger}>
              {certificates.map((certificate, index) => (
                <a
                  aria-label={`View certificate: ${certificate.title}`}
                  className={styles.certificateRow}
                  data-certificate
                  href={certificate.url}
                  key={certificate.url}
                  rel="noreferrer"
                  target="_blank"
                >
                  <span className={styles.certificateNumber}>{String(index + 1).padStart(2, "0")}</span>
                  <span className={styles.certificateCopy}>
                    <strong>{certificate.title}</strong>
                    <span>{certificate.issuer}</span>
                  </span>
                  <time>{certificate.date}</time>
                  <span className={styles.certificateAction} aria-hidden="true">View ↗</span>
                  <span className="srOnly"> (opens in a new tab)</span>
                </a>
              ))}
            </div>
          </div>
        </section>

        <section
          className={styles.contact}
          data-glass-zone="contact"
          id="contact"
          aria-labelledby="contact-title"
        >
          <div className={`${styles.sectionFrame} ${styles.contactInner}`}>
            <div className={styles.contactCopy}>
              <p className={styles.kicker}><span>05</span> Contact</p>
              <h2 id="contact-title">Have a useful product to build?</h2>
              <p className={styles.contactIntro}>
                I&apos;m open to software engineering, agentic AI, and data science roles and projects. Send me the
                problem, the people it should help, and what already exists.
              </p>
              <a className={styles.email} href={`mailto:${profile.email}`}>
                {profile.email} <span aria-hidden="true">↗</span>
              </a>
            </div>

            <footer className={styles.footer}>
              <p>{profile.name} · 2026</p>
              <nav aria-label="Social links">
                <a href={profile.github} target="_blank" rel="noreferrer">
                  GitHub<span className="srOnly"> (opens in a new tab)</span>
                </a>
                <a href={profile.linkedin} target="_blank" rel="noreferrer">
                  LinkedIn<span className="srOnly"> (opens in a new tab)</span>
                </a>
                <a href={profile.resume} download>Résumé</a>
              </nav>
              <a href="#main-content">Back to top <span aria-hidden="true">↑</span></a>
            </footer>
          </div>
        </section>
      </main>
    </HomeRuntime>
  );
}
