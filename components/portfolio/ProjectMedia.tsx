import Image from "next/image";
import styles from "./ProjectMedia.module.css";

type ProjectMediaProps = {
  alt: string;
  label: string;
  number: string;
  primary: string;
  priority?: boolean;
  sizes: string;
};

export function ProjectMedia({
  alt,
  label,
  number,
  primary,
  priority = false,
  sizes,
}: ProjectMediaProps) {
  return (
    <div className={styles.root} data-project-media data-project-sheet>
      <div aria-hidden="true" className={styles.sheetBar} data-project-sheet-bar>
        <span>{label}</span>
        <span>{number}</span>
      </div>
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
    </div>
  );
}
