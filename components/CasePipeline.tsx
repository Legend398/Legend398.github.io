import Image from "next/image";
import type { Project } from "@/lib/portfolio";
import styles from "./CasePipeline.module.css";

type PipelineVariant = "loop-control" | "atomic-transaction" | "model-inference";

type CasePipelineProps = {
  projectTitle: string;
  visual: Project["visual"];
  stages: Project["pipeline"];
};

const variants: Record<
  Project["visual"],
  { id: PipelineVariant; src: string; alt: string }
> = {
  loop: {
    id: "loop-control",
    src: "/work/loop-pipeline.png",
    alt: "Loop Engineering closed-loop workflow showing task clarification, planning, implementation, fresh checks, independent verification, delivery, and the verify-again return path.",
  },
  stocklane: {
    id: "atomic-transaction",
    src: "/work/stocklane-pipeline.png",
    alt: "Stocklane atomic inventory reservation workflow showing order receipt, line validation, one transaction, reserved inventory, fulfil or cancellation, and rollback when any line fails.",
  },
  credit: {
    id: "model-inference",
    src: "/work/credit-risk-pipeline.png",
    alt: "Credit Risk Explorer pipeline showing eight inputs, validation, preprocessing, the XGBoost model, and an explained educational risk assessment.",
  },
};

export function CasePipeline({ projectTitle, visual, stages }: CasePipelineProps) {
  const variant = variants[visual];

  return (
    <figure
      className={styles.figure}
      data-case-pipeline
      data-case-pipeline-variant={variant.id}
    >
      <figcaption className="srOnly">{projectTitle} workflow</figcaption>

      <a
        className={styles.sheet}
        href={variant.src}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={`Open the full-size ${projectTitle} workflow diagram`}
      >
        <Image
          className={styles.image}
          data-case-pipeline-image
          src={variant.src}
          alt={variant.alt}
          width={1536}
          height={1024}
          sizes="(max-width: 980px) calc(100vw - 28px), 950px"
        />
        <span className={styles.openLabel} aria-hidden="true">Open full size ↗</span>
      </a>

      <ol className="srOnly" aria-label={`${projectTitle} workflow`}>
        {stages.map((stage, index) => (
          <li
            key={stage.title}
            data-case-pipeline-stage
            data-stage-index={String(index + 1).padStart(2, "0")}
            data-has-branch={stage.branch ? "true" : "false"}
          >
            <h3 data-case-pipeline-title>{stage.title}</h3>
            <p>{stage.detail}</p>
            {stage.branch ? <p>{stage.branch}</p> : null}
          </li>
        ))}
      </ol>
    </figure>
  );
}
