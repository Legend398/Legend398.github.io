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
    <div className={styles.root} data-project-media>
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
