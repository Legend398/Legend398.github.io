"use client";

import Image from "next/image";
import { useEffect, useRef, useState, type PointerEvent } from "react";
import styles from "./ProjectMedia.module.css";

type ProjectMediaProps = {
  alt: string;
  primary: string;
  priority?: boolean;
  secondary: string;
  secondaryAlt: string;
  sizes: string;
};

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value));
}

export function ProjectMedia({
  alt,
  primary,
  priority = false,
  secondary,
  secondaryAlt,
  sizes,
}: ProjectMediaProps) {
  const root = useRef<HTMLDivElement>(null);
  const [pointerInside, setPointerInside] = useState(false);

  useEffect(() => {
    const element = root.current;
    if (!element || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let frame = 0;
    const update = () => {
      frame = 0;
      const rect = element.getBoundingClientRect();
      const viewport = Math.max(1, window.innerHeight);
      if (rect.bottom < -100 || rect.top > viewport + 100) return;
      const position = clamp((rect.top + rect.height / 2 - viewport / 2) / viewport, -1, 1);
      element.style.setProperty("--media-shift", `${position * -11}px`);
      element.style.setProperty("--media-tilt", `${position * 1.8}deg`);
    };
    const schedule = () => {
      if (!frame) frame = window.requestAnimationFrame(update);
    };

    update();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule, { passive: true });
    return () => {
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, []);

  const updatePointer = (event: PointerEvent<HTMLDivElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    const x = ((event.clientX - bounds.left) / bounds.width) * 100;
    const y = ((event.clientY - bounds.top) / bounds.height) * 100;
    event.currentTarget.style.setProperty("--media-x", `${x}%`);
    event.currentTarget.style.setProperty("--media-y", `${y}%`);
  };

  return (
    <div
      className={styles.root}
      data-pointer-inside={pointerInside ? "true" : "false"}
      data-project-media
      onPointerEnter={(event) => {
        if (event.pointerType !== "touch") setPointerInside(true);
        updatePointer(event);
      }}
      onPointerLeave={() => setPointerInside(false)}
      onPointerMove={updatePointer}
      ref={root}
    >
      <div className={styles.motionPlane}>
        <div className={styles.primary}>
          <Image
            alt={alt}
            data-project-primary
            fill
            priority={priority}
            quality={90}
            sizes={sizes}
            src={primary}
          />
        </div>
        <div className={styles.secondary}>
          <Image
            alt={secondaryAlt}
            data-project-secondary
            fill
            quality={88}
            sizes={sizes}
            src={secondary}
          />
        </div>
        <span className={styles.dotField} aria-hidden="true" />
      </div>
    </div>
  );
}
