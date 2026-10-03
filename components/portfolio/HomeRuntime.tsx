"use client";

import { ReactLenis } from "lenis/react";
import { useEffect, useState, useSyncExternalStore, type ReactNode } from "react";

import styles from "./HomeRuntime.module.css";

const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";
const HERO_SCENE_READY_EVENT = "hero-scene-ready";
const LOADER_MINIMUM_MS = 600;
const LOADER_EXIT_MS = 680;

type LoaderPhase = "loading" | "leaving" | "hidden";

function clamp01(value: number) {
  return Math.min(1, Math.max(0, value));
}

function smoothstep(from: number, to: number, value: number) {
  const progress = clamp01((value - from) / Math.max(to - from, 0.0001));
  return progress * progress * (3 - 2 * progress);
}

function easeOutCubic(value: number) {
  return 1 - Math.pow(1 - clamp01(value), 3);
}

function subscribe(onChange: () => void) {
  const query = window.matchMedia(REDUCED_MOTION_QUERY);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

export function HomeRuntime({ children }: { children: ReactNode }) {
  const [loaderPhase, setLoaderPhase] = useState<LoaderPhase>("loading");
  const reducedMotion = useSyncExternalStore(
    subscribe,
    () => window.matchMedia(REDUCED_MOTION_QUERY).matches,
    () => true,
  );

  useEffect(() => {
    const documentElement = document.documentElement;
    const previousOverflow = documentElement.style.overflow;
    const startedAt = performance.now();
    let releaseStarted = false;
    let revealTimer = 0;
    let removeTimer = 0;

    documentElement.style.overflow = "hidden";
    documentElement.dataset.portfolioLoading = "true";

    const unlockPage = () => {
      documentElement.style.overflow = previousOverflow;
      delete documentElement.dataset.portfolioLoading;
    };

    const releaseLoader = () => {
      if (releaseStarted) return;
      releaseStarted = true;
      const remainingMinimum = Math.max(0, LOADER_MINIMUM_MS - (performance.now() - startedAt));
      revealTimer = window.setTimeout(() => {
        setLoaderPhase("leaving");
        removeTimer = window.setTimeout(() => {
          setLoaderPhase("hidden");
          unlockPage();
        }, LOADER_EXIT_MS);
      }, remainingMinimum);
    };

    const allowsStaticFallback = window.matchMedia(REDUCED_MOTION_QUERY).matches;
    const releaseForCompleteScene = (event: Event) => {
      const mode = (event as CustomEvent<{ mode?: string }>).detail?.mode;
      if (mode === "webgl" || allowsStaticFallback) releaseLoader();
    };
    const scene = document.querySelector<HTMLElement>(".glassScene");
    if (
      scene?.dataset.renderState === "ready"
      && (scene.dataset.sceneMode === "webgl" || allowsStaticFallback)
    ) {
      releaseLoader();
    }
    window.addEventListener(HERO_SCENE_READY_EVENT, releaseForCompleteScene);

    return () => {
      window.clearTimeout(revealTimer);
      window.clearTimeout(removeTimer);
      window.removeEventListener(HERO_SCENE_READY_EVENT, releaseForCompleteScene);
      unlockPage();
    };
  }, []);

  useEffect(() => {
    const root = document.querySelector<HTMLElement>("[data-home-root]");
    const hero = document.querySelector<HTMLElement>("[data-v8-hero]");
    if (!root || !hero) return;

    let frame = 0;

    const renderHandoff = () => {
      frame = 0;

      if (reducedMotion) {
        root.style.setProperty("--handoff-p", "0");
        root.style.setProperty("--handoff-lift", "0px");
        root.style.setProperty("--scene-exit", "0");
        root.style.setProperty("--scene-opacity", "1");
        root.style.setProperty("--hero-wash-opacity", "0");
        root.style.setProperty("--relay-opacity", "0");
        root.style.setProperty("--relay-travel", "0px");
        root.style.setProperty("--about-grid-opacity", "0.12");
        root.style.setProperty("--profile-card-x", "0px");
        root.style.setProperty("--profile-card-y", "0px");
        root.style.setProperty("--profile-card-scale", "1");
        root.style.setProperty("--profile-card-rotate", "0deg");
        root.style.setProperty("--profile-card-opacity", "1");
        root.style.setProperty("--profile-copy-x", "0px");
        root.style.setProperty("--profile-rise", "0px");
        root.style.setProperty("--profile-opacity", "1");
        root.style.setProperty("--profile-blur", "0px");
        root.style.setProperty("--profile-clip", "0%");
        return;
      }

      const viewportHeight = Math.max(window.innerHeight, 1);
      const heroBottom = hero.getBoundingClientRect().bottom;
      const progress = clamp01((viewportHeight * 0.92 - heroBottom) / (viewportHeight * 0.9));
      const sceneExit = smoothstep(0.08, 0.58, progress);
      const sceneFade = smoothstep(0.3, 0.72, progress);
      const fieldProgress = smoothstep(0.1, 0.62, progress);
      const compact = window.innerWidth <= 760;
      const cardProgress = easeOutCubic(clamp01((progress - (compact ? 0.18 : 0.2)) / (compact ? 0.34 : 0.36)));
      const copyProgress = easeOutCubic(clamp01((progress - 0.3) / 0.28));
      const relayIn = smoothstep(0.18, 0.32, progress);
      const relayOut = 1 - smoothstep(0.58, 0.76, progress);
      const overlap = compact
        ? Math.min(190, Math.max(150, viewportHeight * 0.22))
        : Math.min(420, Math.max(250, viewportHeight * 0.42));

      const nextHandoffPhase = progress < 0.16
        ? "hero"
        : progress < 0.48
          ? "optical-relay"
          : progress < 0.88
            ? "profile-resolve"
            : "profile";
      if (root.dataset.handoffPhase !== nextHandoffPhase) {
        root.dataset.handoffPhase = nextHandoffPhase;
      }
      root.style.setProperty("--handoff-p", progress.toFixed(4));
      root.style.setProperty("--handoff-lift", `${((1 - fieldProgress) * overlap).toFixed(2)}px`);
      root.style.setProperty("--scene-exit", sceneExit.toFixed(4));
      root.style.setProperty("--scene-opacity", (1 - sceneFade).toFixed(4));
      root.style.setProperty("--hero-wash-opacity", (fieldProgress * 0.68).toFixed(4));
      root.style.setProperty("--relay-opacity", (relayIn * relayOut).toFixed(4));
      root.style.setProperty("--relay-travel", `${((progress - 0.25) * -150).toFixed(2)}px`);
      root.style.setProperty("--about-grid-opacity", (0.1 + fieldProgress * 0.18).toFixed(4));
      root.style.setProperty("--profile-card-x", `${((1 - cardProgress) * -46).toFixed(2)}px`);
      root.style.setProperty("--profile-card-y", `${((1 - cardProgress) * (compact ? 86 : 170)).toFixed(2)}px`);
      root.style.setProperty("--profile-card-scale", ((compact ? 0.92 : 0.86) + cardProgress * (compact ? 0.08 : 0.14)).toFixed(4));
      root.style.setProperty("--profile-card-rotate", `${((1 - cardProgress) * -2.2).toFixed(2)}deg`);
      root.style.setProperty("--profile-card-opacity", cardProgress.toFixed(4));
      root.style.setProperty("--profile-copy-x", `${((1 - copyProgress) * (compact ? 0 : 62)).toFixed(2)}px`);
      root.style.setProperty("--profile-rise", `${((1 - copyProgress) * 34).toFixed(2)}px`);
      root.style.setProperty("--profile-opacity", copyProgress.toFixed(4));
    };

    const scheduleHandoff = () => {
      if (!frame) frame = window.requestAnimationFrame(renderHandoff);
    };

    renderHandoff();
    window.addEventListener("scroll", scheduleHandoff, { passive: true });
    window.addEventListener("resize", scheduleHandoff);

    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      window.removeEventListener("scroll", scheduleHandoff);
      window.removeEventListener("resize", scheduleHandoff);
    };
  }, [reducedMotion]);

  const content = reducedMotion ? children : (
    <ReactLenis
      root
      options={{
        anchors: { offset: -76 },
        autoRaf: true,
        duration: 0.78,
        smoothWheel: true,
        syncTouch: false,
        wheelMultiplier: 1,
      }}
    >
      {children}
    </ReactLenis>
  );

  return (
    <>
      {loaderPhase !== "hidden" ? (
        <div
          className={styles.loader}
          data-state={loaderPhase}
          role="status"
          aria-live="polite"
          aria-label="Loading portfolio"
        >
          <div className={styles.loaderFrame}>
            <div className={styles.loaderTopline}>
              <span>HIMANSHU.KUMAR</span>
              <span>PORTFOLIO / 2026</span>
            </div>
            <div className={styles.loaderCenter}>
              <span className={styles.loaderMark} aria-hidden="true">HK</span>
              <p>Preparing the portfolio</p>
              <div className={styles.loaderTrack} aria-hidden="true"><span /></div>
              <small>3D scene · interaction · selected work</small>
            </div>
          </div>
        </div>
      ) : null}
      {content}
    </>
  );
}
