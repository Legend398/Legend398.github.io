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
  { id: PipelineVariant; label: string; noteLabel: string }
> = {
  loop: {
    id: "loop-control",
    label: "Closed-loop verification",
    noteLabel: "Verification return",
  },
  stocklane: {
    id: "atomic-transaction",
    label: "Atomic reservation",
    noteLabel: "Rollback outcome",
  },
  credit: {
    id: "model-inference",
    label: "Validated inference",
    noteLabel: "Invalid input path",
  },
};

function StocklaneMotif({ index }: { index: number }) {
  if (index === 0) {
    return (
      <span className={`${styles.stageMotif} ${styles.orderSheet}`} aria-hidden="true">
        <span />
        <span />
        <span />
      </span>
    );
  }

  if (index === 1) {
    return (
      <span className={`${styles.stageMotif} ${styles.validationLedger}`} aria-hidden="true">
        <span><i /> <b /></span>
        <span><i /> <b /></span>
        <span><i /> <b /></span>
      </span>
    );
  }

  if (index === 2) {
    return (
      <span className={`${styles.stageMotif} ${styles.transactionChamber}`} aria-hidden="true">
        <small>ONE TRANSACTION</small>
        <span>BEGIN</span>
        <i>ALL LINES</i>
        <b>COMMIT</b>
      </span>
    );
  }

  if (index === 3) {
    return (
      <span className={`${styles.stageMotif} ${styles.inventoryLedger}`} aria-hidden="true">
        <small>ON HAND</small><small>RESERVED</small><small>AVAILABLE</small>
        <i /><i /><i />
        <i /><i /><i />
      </span>
    );
  }

  return (
    <span className={`${styles.stageMotif} ${styles.orderActions}`} aria-hidden="true">
      <span>FULFIL</span>
      <span>CANCEL</span>
    </span>
  );
}

function CreditMotif({ index }: { index: number }) {
  if (index === 0) {
    return (
      <span className={`${styles.stageMotif} ${styles.inputStack}`} aria-hidden="true">
        {Array.from({ length: 8 }, (_, item) => <i key={item} />)}
      </span>
    );
  }

  if (index === 1) {
    return (
      <span className={`${styles.stageMotif} ${styles.validationGate}`} aria-hidden="true">
        <i>VALID</i>
        <b>×</b>
      </span>
    );
  }

  if (index === 2) {
    return (
      <span className={`${styles.stageMotif} ${styles.preprocessingMatrix}`} aria-hidden="true">
        {Array.from({ length: 12 }, (_, item) => <i key={item} />)}
      </span>
    );
  }

  if (index === 3) {
    return (
      <span className={`${styles.stageMotif} ${styles.modelCore}`} aria-hidden="true">
        <i /><i /><i /><i /><i /><i /><i />
        <b>XGBOOST</b>
      </span>
    );
  }

  return (
    <span className={`${styles.stageMotif} ${styles.resultSheet}`} aria-hidden="true">
      <i />
      <span>Relative score</span>
      <span>Risk band</span>
      <span>Review flag</span>
      <span>Educational estimate</span>
    </span>
  );
}

function StageMotif({ visual, index }: { visual: Project["visual"]; index: number }) {
  if (visual === "stocklane") return <StocklaneMotif index={index} />;
  if (visual === "credit") return <CreditMotif index={index} />;
  return null;
}

function BranchNote({
  label,
  stage,
  visual,
  inline = false,
}: {
  label: string;
  stage: Project["pipeline"][number];
  visual: Project["visual"];
  inline?: boolean;
}) {
  if (!stage.branch) return null;

  return (
    <aside
      className={`${styles.returnNote} ${inline ? styles.inlineReturnNote : ""}`}
      role="note"
      aria-label={label}
    >
      <span>{label}</span>
      <p><strong>{stage.title}:</strong> {stage.branch}</p>
      {visual === "loop" ? <small aria-hidden="true">↖ Return to 04</small> : null}
      {visual === "stocklane" ? <small aria-hidden="true">Inventory unchanged</small> : null}
    </aside>
  );
}

export function CasePipeline({ projectTitle, visual, stages }: CasePipelineProps) {
  const variant = variants[visual];
  const returnPaths = stages.filter((stage) => stage.branch);

  return (
    <figure
      className={`${styles.figure} ${styles[visual]}`}
      data-case-pipeline
      data-case-pipeline-variant={variant.id}
    >
      <figcaption className="srOnly">{projectTitle} workflow</figcaption>

      <div className={styles.diagramLabel} aria-hidden="true">
        <span>{variant.label}</span>
        <small>{String(stages.length).padStart(2, "0")} stages</small>
      </div>

      {visual === "loop" ? (
        <div className={styles.loopTrack} aria-hidden="true">
          <i /><i /><i /><i /><i /><i />
        </div>
      ) : null}

      <ol className={styles.pipeline} aria-label={`${projectTitle} workflow`}>
        {stages.map((stage, index) => (
          <li
            key={stage.title}
            data-case-pipeline-stage
            data-stage-index={String(index + 1).padStart(2, "0")}
            data-has-branch={stage.branch ? "true" : "false"}
          >
            <StageMotif visual={visual} index={index} />
            <div className={styles.stageCopy}>
              <span className={styles.number} aria-hidden="true">
                {String(index + 1).padStart(2, "0")}
              </span>
              <div>
                <h3 data-case-pipeline-title>{stage.title}</h3>
                <p>{stage.detail}</p>
              </div>
            </div>
            {visual === "stocklane" && stage.branch ? (
              <BranchNote label={variant.noteLabel} stage={stage} visual={visual} inline />
            ) : null}
          </li>
        ))}
      </ol>

      {visual !== "stocklane"
        ? returnPaths.map((stage) => (
            <BranchNote key={stage.title} label={variant.noteLabel} stage={stage} visual={visual} />
          ))
        : null}
    </figure>
  );
}
