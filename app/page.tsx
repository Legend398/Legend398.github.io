import Image from "next/image";
import Link from "next/link";
import { HeroExperience } from "@/components/HeroExperience";
import { capabilities, profile, projects } from "@/lib/portfolio";

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

export default function HomePage() {
  return (
    <main className="portfolioHome portfolioHomeV2" id="main-content">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <section className="homeHero" aria-labelledby="hero-title">
        <div className="homeHeroInner">
          <p className="homeRole">{profile.role}</p>
          <p className="homeHeroMeta" aria-label="Portfolio edition">
            <span>Himanshu Kumar</span>
            <span>Portfolio · 2026</span>
          </p>

          <HeroExperience
            className="homeGlassWord"
            description="A clear glass word reading BUILD. It stays sharp until the pointer passes directly over a letter."
          />

          <div className="homeHeroCopy">
            <h1 id="hero-title">I turn product ideas into working software.</h1>
            <p>
              I&apos;m Himanshu Kumar. I build web products, coding-agent tools, and data applications—from the
              interface and backend to the tests that show they work.
            </p>
            <div className="homeHeroActions">
              <a className="homePrimaryLink" href={profile.resume} download>
                Download résumé <span aria-hidden="true">↓</span>
              </a>
              <a className="homeTextLink" href={profile.github} target="_blank" rel="noreferrer">
                GitHub <span aria-hidden="true">↗</span>
                <span className="srOnly"> (opens in a new tab)</span>
              </a>
            </div>
          </div>

          <p className="homeScrollCue" aria-hidden="true">
            Scroll <span>↓</span>
          </p>
        </div>
      </section>

      <section className="homeAbout" id="about" aria-labelledby="about-title">
        <div className="homeSectionFrame homeAboutGrid">
          <figure className="homePortrait">
            <Image
              src="/himanshu-kumar-portrait-1800.jpeg"
              alt="Portrait of Himanshu Kumar"
              fill
              quality={88}
              sizes="(max-width: 760px) 72vw, 33vw"
            />
            <figcaption>Himanshu Kumar · Computer Science and Engineering, 2026</figcaption>
          </figure>

          <div className="homeAboutCopy">
            <p className="homeKicker"><span>01</span> About</p>
            <h2 id="about-title">A software engineer who can follow the problem across the stack.</h2>
            <div className="homeLeadCopy">
              <p>
                My work moves between product interfaces, backend rules, agent workflows, and machine-learning
                systems. I like projects where the hard part is not only building the feature, but making the result
                clear, testable, and useful.
              </p>
              <p>
                I completed a B.Tech in Computer Science and Engineering at Lovely Professional University in 2026.
              </p>
            </div>
          </div>

          <div className="homePracticeList" aria-label="Areas of practice">
            {capabilities.map((capability, index) => (
              <article key={capability.title}>
                <span>{String(index + 1).padStart(2, "0")}</span>
                <h3>{capability.title}</h3>
                <p>{capability.copy}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="homeWork" id="work" aria-labelledby="work-title">
        <div className="homeSectionFrame">
          <header className="homeSectionHeader">
            <p className="homeKicker"><span>02</span> Selected work · 2025–2026</p>
            <h2 id="work-title">Three projects, each solving a different kind of problem.</h2>
            <p>Real interfaces and project artifacts first. The deeper decisions, tests, and limits live inside each case study.</p>
          </header>

          <div className="homeProjectGrid">
            {projects.map((project, index) => (
              <article className={`homeProject ${index === 0 ? "homeProjectLead" : ""}`} key={project.slug}>
                <Link
                  className="homeProjectMedia"
                  href={`/work/${project.slug}`}
                  aria-label={`Read the ${project.title} case study`}
                >
                  <Image
                    src={project.image}
                    alt={project.imageAlt}
                    fill
                    priority
                    sizes={index === 0 ? "(max-width: 760px) 100vw, 92vw" : "(max-width: 760px) 100vw, 46vw"}
                  />
                  <span aria-hidden="true">{project.number}</span>
                </Link>
                <div className="homeProjectCopy">
                  <p className="homeProjectMeta">
                    <span>{project.category}</span>
                    <span>{project.date}</span>
                  </p>
                  <h3>{project.title}</h3>
                  <p>{project.strapline}</p>
                  <div className="homeProjectLinks">
                    <Link href={`/work/${project.slug}`}>Read case study <span aria-hidden="true">↗</span></Link>
                    {project.repository ? (
                      <a href={project.repository} target="_blank" rel="noreferrer">
                        GitHub<span className="srOnly"> (opens in a new tab)</span>
                      </a>
                    ) : null}
                  </div>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="homeExperience" id="experience" aria-labelledby="experience-title">
        <div className="homeSectionFrame homeExperienceGrid">
          <div className="homeExperienceStory">
            <p className="homeKicker"><span>03</span> Experience · 2026</p>
            <h2 id="experience-title">Developer tools for embedded engineering.</h2>
            <div className="homeRoleRow">
              <strong>Enlab</strong>
              <span>Software Engineer · Agentic AI Engineer · Data Science</span>
            </div>
            <p className="homeExperienceIntro">
              In 2026, I worked on tools that help AI understand embedded projects and support setup, code
              generation, building, flashing, and debugging.
            </p>
            <ul className="homeExperiencePoints">
              <li>Parsed projects from STM32Cube, PlatformIO, Arduino, ESP-IDF, and Zephyr.</li>
              <li>Organized board, framework, dependency, build, flash, and debug settings for the assistant.</li>
              <li>Built PCB helpers for component selection and pin, footprint, and manufacturer checks.</li>
            </ul>
          </div>

          <div className="homeRecognition" aria-labelledby="recognition-title">
            <p className="homeKicker" id="recognition-title"><span>04</span> Recognition &amp; education</p>
            <div className="homeRecognitionRows">
              {recognition.map((item) => (
                <article key={`${item.date}-${item.title}`}>
                  <time>{item.date}</time>
                  <h3>{item.title}</h3>
                  <p>{item.detail}</p>
                </article>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="homeContact" id="contact" aria-labelledby="contact-title">
        <div className="homeSectionFrame homeContactGrid">
          <p className="homeKicker"><span>05</span> Contact</p>
          <h2 id="contact-title">Let&apos;s talk about what you&apos;re building.</h2>
          <p className="homeContactIntro">
            I&apos;m open to software engineering, agentic AI, and data science roles and projects. Tell me what
            you&apos;re building and where you need help.
          </p>
          <a className="homeEmail" href={`mailto:${profile.email}`}>
            {profile.email} <span aria-hidden="true">↗</span>
          </a>
          <footer className="homeFooter">
            <p>{profile.name}</p>
            <nav aria-label="Social links">
              <a href={profile.github} target="_blank" rel="noreferrer">GitHub<span className="srOnly"> (opens in a new tab)</span></a>
              <a href={profile.linkedin} target="_blank" rel="noreferrer">LinkedIn<span className="srOnly"> (opens in a new tab)</span></a>
              <a href={profile.resume} download>Résumé</a>
            </nav>
            <a href="#main-content">Back to top <span aria-hidden="true">↑</span></a>
          </footer>
        </div>
      </section>
    </main>
  );
}
