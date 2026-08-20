import type { Project } from "@/lib/portfolio";

type CasePipelineProps = {
  projectTitle: string;
  stages: Project["pipeline"];
};

export function CasePipeline({ projectTitle, stages }: CasePipelineProps) {
  const returnPaths = stages.filter((stage) => stage.branch);

  return (
    <figure className="casePipelineFigure" data-case-pipeline>
      <figcaption className="srOnly">{projectTitle} workflow</figcaption>
      <ol className="casePipeline" aria-label={`${projectTitle} workflow`}>
        {stages.map((stage, index) => (
          <li key={stage.title} data-case-pipeline-stage>
            <span className="casePipelineNumber" aria-hidden="true">
              {String(index + 1).padStart(2, "0")}
            </span>
            <div>
              <h3 data-case-pipeline-title>{stage.title}</h3>
              <p>{stage.detail}</p>
            </div>
          </li>
        ))}
      </ol>
      {returnPaths.length > 0 ? (
        <div className="casePipelineReturn" aria-label="Workflow return path">
          <span>Return path</span>
          {returnPaths.map((stage) => (
            <p key={stage.title}><strong>{stage.title}:</strong> {stage.branch}</p>
          ))}
        </div>
      ) : null}
    </figure>
  );
}
