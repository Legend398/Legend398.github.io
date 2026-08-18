import Link from "next/link";
import LiquidEther from "@/components/effects/LiquidEther";
import HimanshuProfileCard from "@/components/profile/HimanshuProfileCard";
import { HomeRuntime } from "@/components/portfolio/HomeRuntime";
import { PortfolioExperience } from "@/components/portfolio/PortfolioExperience";
import { ProjectMedia } from "@/components/portfolio/ProjectMedia";
import { capabilities, profile, projects, type ProjectVisualKind } from "@/lib/portfolio";
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

const recognition = [
  {
    date: "Apr 2026",
    title: "Winner · LPU Innotek 2026",
    detail: "Department of Student Research and Project.",
  },
  {
    date: "Jun 2026",
    title: "Featured by LPU",
    detail: "Student-led product presentation on official university channels.",
  },
  {
    date: "2022–2026",
    title: "B.Tech · Computer Science and Engineering",
    detail: "Lovely Professional University · CGPA 7.87",
  },
] as const;

const projectMedia: Record<ProjectVisualKind, { secondary: string; secondaryAlt: string }> = {
  loop: {
    secondary: "/work/loop-engineering-system.svg",
    secondaryAlt: "Loop Engineering architecture showing the task, implementation, verification, and checker stages.",
  },
  stocklane: {
    secondary: "/work/stocklane-order.png",
    secondaryAlt: "Stocklane order view showing an inventory reservation and its status.",
  },
  credit: {
    secondary: "/work/credit-risk-shap.png",
    secondaryAlt: "A SHAP summary from the Credit Risk Explorer explaining which inputs influenced the model.",
  },
};

const HERO_ETHER_COLORS = ["#07130f", "#2c6656", "#9fcbbd"];

export default function HomePage() {
  return (
    <HomeRuntime>
      <main className={styles.home} id="main-content">
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
        <PortfolioExperience />

        <section className={styles.hero} data-glass-zone="hero" aria-labelledby="hero-title">
          <div className={styles.heroEtherFrame}>
            <LiquidEther
              autoIntensity={1.3}
              autoRampDuration={0.8}
              autoResumeDelay={600}
              autoSpeed={0.26}
              BFECC={false}
              className={styles.heroEtherCanvas}
              colors={HERO_ETHER_COLORS}
              cursorSize={108}
              dt={0.012}
              isViscous
              iterationsPoisson={18}
              iterationsViscous={18}
              mouseForce={14}
              resolution={0.38}
              takeoverDuration={0.35}
              viscous={27}
            />
          </div>
          <div className={`${styles.sectionFrame} ${styles.heroInner}`}>
            <p className={styles.role} data-hero-role>{profile.role}</p>

            <div className={styles.heroTitleBlock} data-hero-title-block>
              <p className={styles.edition}>Portfolio / 2026</p>
              <h1 id="hero-title" aria-label="Software, AI, and data—built to be used.">
                <span aria-hidden="true">Software, AI,</span>
                <span aria-hidden="true">and data—built</span>
                <span aria-hidden="true">to be used.</span>
              </h1>
            </div>

            <div className={styles.mobileGlassSlot} data-mobile-glass-slot aria-hidden="true" />

            <div className={styles.heroBottom} data-hero-bottom>
              <p className={styles.heroIntro}>
                I design agentic AI tools, reliable software products, and clear machine-learning applications.
              </p>
              <div className={styles.heroActions}>
                <a aria-label="View selected work" className={styles.primaryAction} data-primary-action href="#work">
                  <span className={styles.desktopActionText}>View selected work</span>
                  <span aria-hidden="true" className={styles.mobileActionText}>Selected work</span>
                  <span aria-hidden="true">↓</span>
                </a>
                <a aria-label="Download résumé" className={styles.secondaryAction} data-primary-action href={profile.resume} download>
                  <span className={styles.desktopActionText}>Download résumé</span>
                  <span aria-hidden="true" className={styles.mobileActionText}>Résumé</span>
                  <span aria-hidden="true">↓</span>
                </a>
              </div>
              <p className={styles.interactionNote}>Move across BUILD to bend the light</p>
            </div>
          </div>
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
              {projects.map((project, index) => {
                const media = projectMedia[project.visual];
                return (
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
                        secondary={media.secondary}
                        secondaryAlt={media.secondaryAlt}
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
                );
              })}
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

            <aside className={styles.experienceAside} aria-labelledby="recognition-title">
              <p className={styles.kicker} id="recognition-title"><span>04</span> Recognition &amp; education</p>
              <div className={styles.ledger}>
                {recognition.map((item) => (
                  <article className={styles.ledgerRow} key={`${item.date}-${item.title}`}>
                    <time>{item.date}</time>
                    <h3>{item.title}</h3>
                    <p>{item.detail}</p>
                  </article>
                ))}
              </div>
            </aside>
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
