import Image from "next/image";
import styles from "./ProjectMedia.module.css";

type ProjectMediaProps = {
  alt: string;
  primary: string;
  priority?: boolean;
  sizes: string;
};

export function ProjectMedia({
  alt,
  primary,
  priority = false,
  sizes,
}: ProjectMediaProps) {
  return (
    <div className={styles.root} data-project-frame data-project-media>
      <div className={styles.imageWindow}>
        <Image
          alt={alt}
          className={styles.image}
          data-project-primary
          fill
          priority={priority}
          quality={90}
          sizes={sizes}
          src={primary}
        />
      </div>
      <span className={`${styles.corner} ${styles.topLeft}`} data-frame-corner aria-hidden="true" />
      <span className={`${styles.corner} ${styles.topRight}`} data-frame-corner aria-hidden="true" />
      <span className={`${styles.corner} ${styles.bottomRight}`} data-frame-corner aria-hidden="true" />
      <span className={`${styles.corner} ${styles.bottomLeft}`} data-frame-corner aria-hidden="true" />
      <span className={styles.frameCue} data-project-frame-cue aria-hidden="true">
        <span>View case study</span>
        <svg viewBox="0 0 20 20" focusable="false">
          <path d="M5 15 15 5M8 5h7v7" />
        </svg>
      </span>
    </div>
  );
}
