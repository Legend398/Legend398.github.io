"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import HalftoneReveal from "@/components/effects/HalftoneReveal";
import styles from "./ProjectMedia.module.css";

type ProjectMediaProps = {
  alt: string;
  primary: string;
  priority?: boolean;
  sizes: string;
};

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value));
}

export function ProjectMedia({
  alt,
  primary,
  priority = false,
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

  return (
    <div
      className={styles.root}
      data-pointer-inside={pointerInside ? "true" : "false"}
      data-project-media
      onPointerEnter={(event) => {
        if (event.pointerType !== "touch") setPointerInside(true);
      }}
      onPointerLeave={() => setPointerInside(false)}
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
        <HalftoneReveal
          className={styles.halftone}
          printSrc={primary}
          inkColor="#0b221b"
          paperColor="#eee9dd"
          dotDensity={74}
          dotSize={0.94}
          angle={45}
          revealRadius={0.52}
          edge={0.86}
          follow={0.18}
          idleReveal={0.28}
        />
        <span className={styles.revealHint} data-project-reveal-hint aria-hidden="true">
          <svg viewBox="0 0 24 24" focusable="false">
            <circle cx="12" cy="12" r="7" />
            <path d="M12 2v4M12 18v4M2 12h4M18 12h4" />
          </svg>
          Move to see clearly
        </span>
      </div>
    </div>
  );
}
