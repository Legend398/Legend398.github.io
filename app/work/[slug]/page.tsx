import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CasePipeline } from "@/components/CasePipeline";
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
        <p className="sectionKicker" id="evidence-title">Case in one minute</p>
        <dl>
          {project.overview.map((item) => (
            <div key={item.label}><dt>{item.label}</dt><dd>{item.value}</dd></div>
          ))}
        </dl>
      </section>

      <div className="caseBody">
        <aside className="caseRail" aria-label="Case study sections">
          <span>CASE FILE</span>
          <a href="#problem"><span className="caseRailFull">01 / Problem</span><span className="caseRailShort">Problem</span></a>
          <a href="#solution"><span className="caseRailFull">02 / Solution</span><span className="caseRailShort">Solution</span></a>
          <a href="#how-it-works"><span className="caseRailFull">03 / How it works</span><span className="caseRailShort">Flow</span></a>
          <a href="#what-i-built"><span className="caseRailFull">04 / What I built</span><span className="caseRailShort">Built</span></a>
          <a href="#results"><span className="caseRailFull">05 / Results</span><span className="caseRailShort">Results</span></a>
        </aside>

        <div className="caseNarrative">
          <div className="caseOpening">
            <section id="problem" className="caseStorySection caseStorySection-problem">
              <p className="sectionKicker">01 / Problem</p>
              <h2>Problem</h2>
              <p className="caseStatement">{project.problem.statement}</p>
              <p className="caseDetail">{project.problem.detail}</p>
            </section>

            <section id="solution" className="caseStorySection caseStorySection-solution">
              <p className="sectionKicker">02 / Solution</p>
              <h2>Solution</h2>
              <p className="caseStatement">{project.solution.statement}</p>
              <p className="caseDetail">{project.solution.detail}</p>
            </section>
          </div>

          <section id="how-it-works" className="caseFlowSection">
            <div className="caseSectionIntro">
              <p className="sectionKicker">03 / How it works</p>
              <h2>How it works</h2>
              <p>The complete path from input to a finished, inspectable result.</p>
            </div>
            <CasePipeline projectTitle={project.title} stages={project.pipeline} />
          </section>

          <section id="what-i-built" className="caseBuiltSection">
            <div className="caseSectionIntro">
              <p className="sectionKicker">04 / What I built</p>
              <h2>What I built</h2>
              <p>The concrete parts I designed, implemented, and tested.</p>
            </div>
            <ol className="contributionList">
              {project.contributions.map((contribution, index) => (
                <li key={contribution.title}>
                  <span aria-hidden="true">{String(index + 1).padStart(2, "0")}</span>
                  <h3>{contribution.title}</h3>
                  <p>{contribution.body}</p>
                </li>
              ))}
            </ol>
          </section>

          <section id="results" className="caseResultsSection">
            <div className="caseSectionIntro caseSectionIntro-inverse">
              <p className="sectionKicker">05 / Results</p>
              <h2>Results</h2>
              <p>What the finished system demonstrates through working behavior, tests, and project artifacts.</p>
            </div>
            <div className="caseResultsGrid">
              <ul className="resultList">
                {project.results.map((result) => <li key={result}>{result}</li>)}
              </ul>
              <figure className={`caseSecondaryImage ${project.evidenceImage.fit === "contain" ? "caseSecondaryImage-contain" : ""}`}>
                <div>
                  <Image
                    data-case-evidence-image
                    src={project.evidenceImage.src}
                    alt={project.evidenceImage.alt}
                    fill
                    loading="eager"
                    sizes="(max-width: 900px) 100vw, 760px"
                  />
                </div>
                <figcaption>{project.evidenceImage.caption}</figcaption>
              </figure>
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
