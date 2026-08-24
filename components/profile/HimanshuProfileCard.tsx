"use client";

import type { CSSProperties, PointerEvent as ReactPointerEvent } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";

import styles from "./HimanshuProfileCard.module.css";

type CardStyle = CSSProperties & {
  "--pointer-x": string;
  "--pointer-y": string;
  "--rotate-x": string;
  "--rotate-y": string;
  "--glow-color": string;
};

export type HimanshuProfileCardProps = {
  className?: string;
  name?: string;
  title?: string;
  handle?: string;
  status?: string;
  contactText?: string;
  contactHref?: string;
  avatarUrl?: string;
  showUserInfo?: boolean;
  behindGlowEnabled?: boolean;
  behindGlowColor?: string;
  showIconPattern?: boolean;
  enableTilt?: boolean;
};

const DEFAULT_AVATAR = "/himanshu-kumar-portrait-1800.jpeg";
const SETTLE_THRESHOLD = 0.015;

export default function HimanshuProfileCard({
  className = "",
  name = "Himanshu Kumar",
  title = "Software Engineer · Agentic AI Engineer · Data Science",
  handle = "Legend398",
  status = "Open to roles",
  contactText = "Email",
  contactHref = "mailto:hk270941@gmail.com",
  avatarUrl = DEFAULT_AVATAR,
  showUserInfo = true,
  behindGlowEnabled = true,
  behindGlowColor = "rgba(117, 214, 187, 0.48)",
  showIconPattern = false,
  enableTilt = true,
}: HimanshuProfileCardProps) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLElement>(null);
  const frameRef = useRef<number | null>(null);
  const currentRef = useRef({ x: 0, y: 0 });
  const targetRef = useRef({ x: 0, y: 0 });
  const [imageFailed, setImageFailed] = useState(false);

  const applyTilt = useCallback((x: number, y: number) => {
    const wrapper = wrapperRef.current;
    if (!wrapper) return;

    wrapper.style.setProperty("--pointer-x", `${50 + x * 50}%`);
    wrapper.style.setProperty("--pointer-y", `${50 + y * 50}%`);
    wrapper.style.setProperty("--rotate-x", `${-y * 2.5}deg`);
    wrapper.style.setProperty("--rotate-y", `${x * 3}deg`);
  }, []);

  const stopAnimation = useCallback(() => {
    if (frameRef.current !== null) {
      cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    }
  }, []);

  const animateToTarget = useCallback(() => {
    const step = () => {
      const current = currentRef.current;
      const target = targetRef.current;
      current.x += (target.x - current.x) * 0.16;
      current.y += (target.y - current.y) * 0.16;
      applyTilt(current.x, current.y);

      if (Math.abs(target.x - current.x) + Math.abs(target.y - current.y) <= SETTLE_THRESHOLD) {
        current.x = target.x;
        current.y = target.y;
        applyTilt(current.x, current.y);
        frameRef.current = null;
        return;
      }

      frameRef.current = requestAnimationFrame(step);
    };

    if (frameRef.current === null) frameRef.current = requestAnimationFrame(step);
  }, [applyTilt]);

  const canTilt = useCallback(() => {
    if (!enableTilt || typeof window === "undefined") return false;
    return (
      window.matchMedia("(hover: hover) and (pointer: fine)").matches &&
      !window.matchMedia("(prefers-reduced-motion: reduce)").matches
    );
  }, [enableTilt]);

  const handlePointerMove = useCallback(
    (event: ReactPointerEvent<HTMLElement>) => {
      if (!canTilt() || event.pointerType === "touch") return;
      const bounds = event.currentTarget.getBoundingClientRect();
      targetRef.current = {
        x: Math.max(-1, Math.min(1, ((event.clientX - bounds.left) / bounds.width - 0.5) * 2)),
        y: Math.max(-1, Math.min(1, ((event.clientY - bounds.top) / bounds.height - 0.5) * 2)),
      };
      animateToTarget();
    },
    [animateToTarget, canTilt],
  );

  const handlePointerLeave = useCallback(() => {
    targetRef.current = { x: 0, y: 0 };
    animateToTarget();
  }, [animateToTarget]);

  useEffect(() => {
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const resetMotion = () => {
      if (!reducedMotion.matches) return;
      stopAnimation();
      currentRef.current = { x: 0, y: 0 };
      targetRef.current = { x: 0, y: 0 };
      applyTilt(0, 0);
    };

    reducedMotion.addEventListener("change", resetMotion);
    return () => {
      reducedMotion.removeEventListener("change", resetMotion);
      stopAnimation();
    };
  }, [applyTilt, stopAnimation]);

  const cardStyle: CardStyle = {
    "--pointer-x": "50%",
    "--pointer-y": "50%",
    "--rotate-x": "0deg",
    "--rotate-y": "0deg",
    "--glow-color": behindGlowColor,
  };

  const wrapperClassName = [styles.wrapper, className].filter(Boolean).join(" ");

  return (
    <div ref={wrapperRef} className={wrapperClassName} data-profile-card style={cardStyle}>
      {behindGlowEnabled ? <span className={styles.behindGlow} data-profile-behind-glow aria-hidden="true" /> : null}
      <article
        ref={cardRef}
        className={styles.card}
        onPointerMove={handlePointerMove}
        onPointerLeave={handlePointerLeave}
        aria-label={`${name}, ${title}`}
      >
        <span className={styles.ambientLight} aria-hidden="true" />
        {showIconPattern ? <span className={styles.iconPattern} data-profile-icon-pattern aria-hidden="true" /> : null}

        <div className={styles.portraitFrame}>
          {imageFailed ? (
            <div className={styles.imageFallback} role="img" aria-label={`Portrait placeholder for ${name}`}>
              HK
            </div>
          ) : (
            <Image
              className={styles.portrait}
              src={avatarUrl}
              alt={`Portrait of ${name}`}
              fill
              sizes="(max-width: 390px) 100vw, 390px"
              onError={() => setImageFailed(true)}
            />
          )}
          {!imageFailed ? (
            <Image
              className={styles.portraitEcho}
              src={avatarUrl}
              alt=""
              aria-hidden="true"
              fill
              sizes="(max-width: 390px) 100vw, 390px"
            />
          ) : null}
        </div>

        <header className={styles.heading}>
          <h2>{name}</h2>
          <p className={styles.title} title={title}>
            {title}
          </p>
        </header>

        {showUserInfo ? (
          <footer className={styles.userPanel} data-profile-user-info>
            <div className={styles.identity}>
              <span className={styles.avatarMini} aria-hidden="true">
                {imageFailed ? (
                  "HK"
                ) : (
                  <Image
                    src={avatarUrl}
                    alt=""
                    width={38}
                    height={38}
                    onError={() => setImageFailed(true)}
                  />
                )}
              </span>
              <span className={styles.userCopy}>
                {handle ? <strong title={`@${handle}`}>@{handle}</strong> : null}
                <small title={status}>{status}</small>
              </span>
            </div>
            <a className={styles.contactLink} href={contactHref} aria-label={`${contactText}, contact ${name}`}>
              {contactText}
            </a>
          </footer>
        ) : null}
      </article>
    </div>
  );
}
