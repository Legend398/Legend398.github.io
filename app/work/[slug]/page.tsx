import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ProjectVisual } from "@/components/ProjectVisual";
import { getProject, profile, projects } from "@/lib/portfolio";

type WorkPageProps = {
  params: Promise<{ slug: string }>;
};

export function generateStaticParams() {
  return projects.map((project) => ({ slug: project.slug }));
}

export async function generateMetadata({ params }: WorkPageProps): Promise<Metadata> {
  const { slug } = await params;
  const project = getProject(slug);
  if (!project) return {};

  return {
    title: project.title,
    description: project.summary,
    alternates: { canonical: `/work/${project.slug}` },
    openGraph: {
      title: project.title,
      description: project.summary,
      url: `/work/${project.slug}`,
      type: "article",
      images: [
        {
          url: "/opengraph-image",
          width: 1200,
          height: 630,
          alt: `${profile.name} — ${profile.role}`,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: project.title,
      description: project.summary,
      images: ["/opengraph-image"],
    },
  };
}

export default async function WorkPage({ params }: WorkPageProps) {
  const { slug } = await params;
  const project = getProject(slug);
  if (!project) notFound();

  const projectIndex = projects.findIndex((candidate) => candidate.slug === project.slug);
  const nextProject = projects[(projectIndex + 1) % projects.length];
  const projectTotal = String(projects.length).padStart(2, "0");

  return (
    <main id="main-content" className="casePage">
      <header className="caseHero">
        <div className="caseTopline">
          <Link href="/#work">← Selected work</Link>
          <span>{project.number} / {projectTotal}</span>
        </div>
        <div className="caseTitleGrid">
          <div>
            <p className="sectionKicker">{project.category}</p>
            <h1>{project.title}</h1>
          </div>
          <p>{project.strapline}</p>
        </div>
        <dl className="caseMeta">
          <div><dt>Role</dt><dd>{project.role}</dd></div>
          <div><dt>Date</dt><dd>{project.date}</dd></div>
          <div><dt>Stack</dt><dd>{project.stack.join(" · ")}</dd></div>
          <div>
            <dt>Links</dt>
            <dd>
              {project.repository ? <a href={project.repository} target="_blank" rel="noreferrer">Repository ↗</a> : <span>Local build</span>}
              {project.live ? <a href={project.live} target="_blank" rel="noreferrer">Live demo ↗</a> : null}
            </dd>
          </div>
        </dl>
      </header>

      <div className="caseArtifact">
        <ProjectVisual project={project} priority />
      </div>

      <section className="caseEvidence" aria-labelledby="evidence-title">
        <p className="sectionKicker" id="evidence-title">At a glance</p>
        <dl>
          {project.evidence.map((item) => (
            <div key={item.label}><dt>{item.label}</dt><dd>{item.value}</dd></div>
          ))}
        </dl>
      </section>

      <div className="caseBody">
        <aside className="caseRail" aria-label="Case study sections">
          <span>CASE FILE</span>
          <a href="#problem">01 / Problem</a>
          <a href="#constraints">02 / Constraints</a>
          <a href="#decisions">03 / Decisions</a>
          <a href="#verification">04 / Verification</a>
          <a href="#tradeoffs">05 / Trade-offs</a>
        </aside>

        <div className="caseNarrative">
          <section id="problem">
            <p className="sectionKicker">01 / Problem</p>
            <h2>{project.strapline}</h2>
            <p className="caseLead">{project.problem}</p>
          </section>

          <section id="constraints">
            <p className="sectionKicker">02 / Constraints</p>
            <h2>The boundaries shaped the product.</h2>
            <ul className="numberList">
              {project.constraints.map((constraint, index) => (
                <li key={constraint}><span>{String(index + 1).padStart(2, "0")}</span>{constraint}</li>
              ))}
            </ul>
          </section>

          <section id="decisions">
            <p className="sectionKicker">03 / Decisions</p>
            <h2>What I chose—and why.</h2>
            <div className="decisionList">
              {project.decisions.map((decision, index) => (
                <article key={decision.title}>
                  <span>{String(index + 1).padStart(2, "0")}</span>
                  <h3>{decision.title}</h3>
                  <p>{decision.body}</p>
                </article>
              ))}
            </div>
          </section>

          {project.slug === "stocklane" ? (
            <figure className="caseSecondaryImage">
              <div>
                <Image
                  src="/work/stocklane-order.png"
                  alt="Stocklane order result showing that two units were reserved and available stock updated before fulfilment."
                  fill
                  priority
                  sizes="(max-width: 900px) 100vw, 900px"
                />
              </div>
              <figcaption>The interface explains the reservation state before the terminal action.</figcaption>
            </figure>
          ) : null}

          {project.slug === "loop-engineering" ? (
            <figure className="caseSecondaryImage caseSecondaryImage-contain">
              <div>
                <Image
                  src="/work/loop-engineering-system.svg"
                  alt="Loop Engineering architecture showing the task state machine, verification, checker review, and stale-evidence return path."
                  fill
                  sizes="(max-width: 900px) 100vw, 900px"
                />
              </div>
              <figcaption>The repository documents the control flow and the conditions that return work to implementation.</figcaption>
            </figure>
          ) : null}

          {project.slug === "credit-risk-explorer" ? (
            <figure className="caseSecondaryImage caseSecondaryImage-contain">
              <div>
                <Image
                  src="/work/credit-risk-shap.png"
                  alt="SHAP summary chart from the Credit Risk Explorer model showing how input features influence risk estimates."
                  fill
                  sizes="(max-width: 900px) 100vw, 900px"
                />
              </div>
              <figcaption>The project includes model-level feature analysis alongside the user-facing educational assessment.</figcaption>
            </figure>
          ) : null}

          <section id="verification" className="verificationSection">
            <p className="sectionKicker">04 / Verification</p>
            <h2>What the evidence establishes.</h2>
            <ul>
              {project.verification.map((proof) => <li key={proof}>{proof}</li>)}
            </ul>
          </section>

          <section id="tradeoffs">
            <p className="sectionKicker">05 / Trade-offs</p>
            <h2>The honest edge of the work.</h2>
            <div className="tradeoffList">
              {project.tradeoffs.map((tradeoff) => <p key={tradeoff}>{tradeoff}</p>)}
            </div>
          </section>
        </div>
      </div>

      <nav className="nextCase" aria-label="Next case study">
        <span>Next case study</span>
        <Link href={`/work/${nextProject.slug}`}>
          <strong>{nextProject.title}</strong>
          <small>{nextProject.strapline}</small>
          <i aria-hidden="true">↗</i>
        </Link>
      </nav>
    </main>
  );
}
