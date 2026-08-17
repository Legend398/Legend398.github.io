import Link from "next/link";
import type { Project } from "@/lib/portfolio";
import { ProjectVisual } from "@/components/ProjectVisual";

export function ProjectChapter({ project }: { project: Project }) {
  const result = project.evidence.find((item) => item.label === "Proof");

  return (
    <article className={`projectChapter projectChapter-${project.visual}`} id={project.slug}>
      <div className="chapterCopy reveal">
        <div className="projectMeta">
          <span>{project.category}</span>
          <span>{project.date}</span>
        </div>
        <h3>{project.title}</h3>
        <p className="projectStrapline">{project.strapline}</p>
        <p className="projectSummary">{project.summary}</p>
        <div className="projectHighlights">
          <span>Key features</span>
          <ul>
            {project.highlights.map((highlight) => <li key={highlight}>{highlight}</li>)}
          </ul>
        </div>
        {result ? <p className="projectResult"><span>Tested result</span>{result.value}</p> : null}
        <p className="stackLine" aria-label={`${project.title} technology stack`}>
          {project.stack.join(" · ")}
        </p>
        <div className="projectActions">
          <Link className="textLink" href={`/work/${project.slug}`}>
            Project details <span aria-hidden="true">↗</span>
          </Link>
          {project.repository ? (
            <a className="quietLink" href={project.repository} target="_blank" rel="noreferrer">
              GitHub <span className="srOnly">(opens in a new tab)</span>
            </a>
          ) : null}
          {project.live ? (
            <a className="quietLink" href={project.live} target="_blank" rel="noreferrer">
              Live demo <span className="srOnly">(opens in a new tab)</span>
            </a>
          ) : null}
        </div>
      </div>

      <div className="chapterArtifact reveal">
        <ProjectVisual project={project} priority={Boolean(project.image)} />
      </div>
    </article>
  );
}
