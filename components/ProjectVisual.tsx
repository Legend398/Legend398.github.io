import Image from "next/image";
import type { Project } from "@/lib/portfolio";

type ProjectVisualProps = {
  project: Project;
  priority?: boolean;
};

const captions: Record<Project["visual"], string> = {
  loop: "Loop Engineering system map connecting scheduling, sub-agents, worktrees, skills, and persistent state.",
  stocklane: "Working Stocklane screen showing on-hand, reserved, available, low-stock, and unavailable states.",
  credit: "Working Credit Risk Explorer screen showing labelled inputs and a completed, explained educational assessment.",
};

export function ProjectVisual({ project, priority = false }: ProjectVisualProps) {
  return (
    <figure className={`projectVisual projectVisual-${project.visual}`}>
      <div className="imageFrame">
        <Image
          src={project.image}
          alt={project.imageAlt}
          fill
          priority={priority}
          sizes="(max-width: 760px) 100vw, (max-width: 1100px) 62vw, 760px"
        />
      </div>
      <figcaption>{captions[project.visual]}</figcaption>
    </figure>
  );
}
