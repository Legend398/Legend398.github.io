"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import styles from "./HeroExperience.module.css";
import type { GlassSceneProps, HeroMotionState } from "./GlassScene";

const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";
const COMPACT_VIEW_QUERY = "(max-width: 760px)";
let cachedWebGLSupport: boolean | undefined;

function subscribeToMediaQuery(queryValue: string, onStoreChange: () => void) {
  const query = window.matchMedia(queryValue);
  query.addEventListener("change", onStoreChange);
  return () => query.removeEventListener("change", onStoreChange);
}

function getWebGLSupportSnapshot() {
  if (cachedWebGLSupport !== undefined) return cachedWebGLSupport;
  try {
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("webgl2", { failIfMajorPerformanceCaveat: true })
      ?? canvas.getContext("webgl", { failIfMajorPerformanceCaveat: true });
    cachedWebGLSupport = Boolean(context);
    context?.getExtension("WEBGL_lose_context")?.loseContext();
  } catch {
    cachedWebGLSupport = false;
  }
  return cachedWebGLSupport;
}

function StaticGlassFallback() {
  return (
    <div className={styles.fallback} data-hero-fallback aria-hidden="true">
      <span className={styles.fallbackWord}>BUILD</span>
    </div>
  );
}

const GlassScene = dynamic<GlassSceneProps>(
  () => import("./GlassScene").then((module) => module.GlassScene),
  { ssr: false, loading: () => <StaticGlassFallback /> },
);

export type HeroExperienceProps = {
  className?: string;
  description?: string;
};

export function HeroExperience({
  className,
  description = "BUILD rendered as a clear glass word. The glass softly frosts only beneath the pointer.",
}: HeroExperienceProps) {
  const reducedMotion = useSyncExternalStore(
    (onChange) => subscribeToMediaQuery(REDUCED_MOTION_QUERY, onChange),
    () => window.matchMedia(REDUCED_MOTION_QUERY).matches,
    () => true,
  );
  const compact = useSyncExternalStore(
    (onChange) => subscribeToMediaQuery(COMPACT_VIEW_QUERY, onChange),
    () => window.matchMedia(COMPACT_VIEW_QUERY).matches,
    () => true,
  );
  const webGLSupported = useSyncExternalStore(
    () => () => undefined,
    getWebGLSupportSnapshot,
    () => false,
  );
  const root = useRef<HTMLElement>(null);
  const motion = useRef<HeroMotionState>({
    pointerActive: false,
    pointerX: 0,
    pointerY: 0,
    renderScale: compact ? 0.72 : 0.82,
    scroll: 0,
  });
  const frameRequester = useRef<() => void>(() => undefined);
  const [isVisible, setIsVisible] = useState(true);
  const renderScene = webGLSupported && !reducedMotion;
  const rootClassName = className ? `${styles.root} ${className}` : styles.root;
  const registerFrameRequester = useCallback((requestFrame?: () => void) => {
    frameRequester.current = requestFrame ?? (() => undefined);
  }, []);

  useEffect(() => {
    const element = root.current;
    if (!element) return;
    let intersects = true;
    const syncVisibility = () => setIsVisible(intersects && document.visibilityState === "visible");
    const observer = new IntersectionObserver(
      ([entry]) => {
        intersects = entry.isIntersecting;
        syncVisibility();
      },
      { rootMargin: "120px 0px" },
    );
    observer.observe(element);
    document.addEventListener("visibilitychange", syncVisibility);
    syncVisibility();
    return () => {
      observer.disconnect();
      document.removeEventListener("visibilitychange", syncVisibility);
    };
  }, []);

  useEffect(() => {
    const element = root.current;
    if (!element || !renderScene || !isVisible) return;
    const hero = element.closest<HTMLElement>(".homeHero") ?? element;
    let scheduledFrame = 0;
    const updateScroll = () => {
      scheduledFrame = 0;
      const rect = hero.getBoundingClientRect();
      const viewport = Math.max(1, window.innerHeight);
      const travel = Math.max(1, rect.height - viewport * 0.72);
      motion.current.scroll = Math.min(1, Math.max(0, -rect.top / travel));
      frameRequester.current();
    };
    const scheduleScrollUpdate = () => {
      if (!scheduledFrame) scheduledFrame = window.requestAnimationFrame(updateScroll);
    };
    window.addEventListener("scroll", scheduleScrollUpdate, { passive: true });
    window.addEventListener("resize", scheduleScrollUpdate, { passive: true });
    updateScroll();
    return () => {
      window.removeEventListener("scroll", scheduleScrollUpdate);
      window.removeEventListener("resize", scheduleScrollUpdate);
      if (scheduledFrame) window.cancelAnimationFrame(scheduledFrame);
    };
  }, [isVisible, renderScene]);

  return (
    <figure
      className={rootClassName}
      aria-label={description}
      data-glass-word="BUILD"
      data-scene-active={renderScene && isVisible}
      data-scene-mode={renderScene ? "webgl" : "fallback"}
      data-scene-quality={compact ? "compact" : "full"}
      ref={root}
    >
      <div className={styles.caustics} aria-hidden="true"><span /><span /></div>
      {renderScene ? (
        <div className={styles.canvasWrap} aria-hidden="true">
          <GlassScene
            active={isVisible}
            compact={compact}
            motion={motion}
            reducedMotion={false}
            registerFrameRequester={registerFrameRequester}
          />
        </div>
      ) : <StaticGlassFallback />}
      <figcaption className={styles.srOnly}>{description}</figcaption>
    </figure>
  );
}
