"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import styles from "./PortfolioExperience.module.css";
import type { GlassInteractionState, PortfolioGlassSceneProps, SceneZone } from "./PortfolioGlassScene";

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

function StaticGlassWord() {
  return (
    <div className={styles.fallback} data-glass-fallback aria-hidden="true">
      <span className={styles.fallbackWord}>BUILD</span>
    </div>
  );
}

const PortfolioGlassScene = dynamic<PortfolioGlassSceneProps>(
  () => import("./PortfolioGlassScene").then((module) => module.PortfolioGlassScene),
  { ssr: false, loading: () => null },
);

function clamp(value: number, minimum = 0, maximum = 1) {
  return Math.min(maximum, Math.max(minimum, value));
}

export function PortfolioExperience() {
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
  const interaction = useRef<GlassInteractionState>({
    pointerActive: false,
    pointerX: 0,
    pointerY: 0,
    progress: 0,
    zone: "hero",
  });
  const frameRequester = useRef<() => void>(() => undefined);
  const [contact, setContact] = useState(false);
  const [documentVisible, setDocumentVisible] = useState(true);
  const [sceneReady, setSceneReady] = useState(false);
  const [zone, setZone] = useState<SceneZone>("hero");
  const renderScene = webGLSupported && !reducedMotion;
  const active = zone !== "none" && documentVisible;

  const registerFrameRequester = useCallback((requestFrame?: () => void) => {
    frameRequester.current = requestFrame ?? (() => undefined);
  }, []);
  const markSceneReady = useCallback(() => setSceneReady(true), []);

  useEffect(() => {
    const syncVisibility = () => setDocumentVisible(document.visibilityState === "visible");
    document.addEventListener("visibilitychange", syncVisibility);
    syncVisibility();
    return () => document.removeEventListener("visibilitychange", syncVisibility);
  }, []);

  useEffect(() => {
    let scheduledFrame = 0;
    const update = () => {
      scheduledFrame = 0;
      const viewport = Math.max(1, window.innerHeight);
      const hero = document.querySelector<HTMLElement>('[data-glass-zone="hero"]');
      const contactZone = document.querySelector<HTMLElement>('[data-glass-zone="contact"]');
      const heroRect = hero?.getBoundingClientRect();
      const contactRect = contactZone?.getBoundingClientRect();
      let nextZone: SceneZone = "none";
      let progress = 0;
      const heroProgress = heroRect
        ? clamp(-heroRect.top / Math.max(1, heroRect.height * 0.82))
        : 0;
      hero?.style.setProperty("--hero-progress", heroProgress.toFixed(4));

      if (heroRect && heroRect.bottom > 0 && heroRect.top < viewport) {
        nextZone = "hero";
        progress = heroProgress;
      } else if (contactRect && contactRect.bottom > 0 && contactRect.top < viewport) {
        nextZone = "contact";
        progress = clamp((viewport - contactRect.top) / Math.max(1, viewport + contactRect.height));
      }

      interaction.current.zone = nextZone;
      interaction.current.progress = progress;
      setZone((current) => current === nextZone ? current : nextZone);
      frameRequester.current();
    };
    const schedule = () => {
      if (!scheduledFrame) scheduledFrame = window.requestAnimationFrame(update);
    };

    update();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule, { passive: true });
    return () => {
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      if (scheduledFrame) window.cancelAnimationFrame(scheduledFrame);
    };
  }, []);

  useEffect(() => {
    if (!renderScene || !active) {
      interaction.current.pointerActive = false;
      return;
    }
    let scheduledFrame = 0;
    let touchPointerActive = false;
    const requestPointerFrame = () => {
      if (!scheduledFrame) {
        scheduledFrame = window.requestAnimationFrame(() => {
          scheduledFrame = 0;
          frameRequester.current();
        });
      }
    };
    const updatePointerPosition = (event: PointerEvent) => {
      interaction.current.pointerX = (event.clientX / Math.max(1, window.innerWidth)) * 2 - 1;
      interaction.current.pointerY = -(event.clientY / Math.max(1, window.innerHeight)) * 2 + 1;
    };
    const updatePointer = (event: PointerEvent) => {
      updatePointerPosition(event);
      interaction.current.pointerActive = event.pointerType !== "touch" || touchPointerActive;
      requestPointerFrame();
    };
    const startTouchPointer = (event: PointerEvent) => {
      if (event.pointerType !== "touch") return;
      touchPointerActive = true;
      updatePointerPosition(event);
      interaction.current.pointerActive = true;
      requestPointerFrame();
    };
    const endTouchPointer = (event: PointerEvent) => {
      if (event.pointerType !== "touch") return;
      touchPointerActive = false;
      interaction.current.pointerActive = false;
      requestPointerFrame();
    };
    const clearPointer = () => {
      interaction.current.pointerActive = false;
      frameRequester.current();
    };
    const handlePointerOut = (event: PointerEvent) => {
      if (!event.relatedTarget) clearPointer();
    };

    window.addEventListener("pointermove", updatePointer, { passive: true });
    window.addEventListener("pointerdown", startTouchPointer, { passive: true });
    window.addEventListener("pointerup", endTouchPointer, { passive: true });
    window.addEventListener("pointercancel", endTouchPointer, { passive: true });
    window.addEventListener("pointerout", handlePointerOut, { passive: true });
    window.addEventListener("blur", clearPointer);
    return () => {
      window.removeEventListener("pointermove", updatePointer);
      window.removeEventListener("pointerdown", startTouchPointer);
      window.removeEventListener("pointerup", endTouchPointer);
      window.removeEventListener("pointercancel", endTouchPointer);
      window.removeEventListener("pointerout", handlePointerOut);
      window.removeEventListener("blur", clearPointer);
      if (scheduledFrame) window.cancelAnimationFrame(scheduledFrame);
    };
  }, [active, renderScene]);

  return (
    <figure
      aria-label="A clear glass word reading BUILD. Moving the pointer directly over the letters changes only the local refraction."
      className={styles.stage}
      data-glass-stage
      data-glass-word="BUILD"
      data-pointer-contact={active && contact ? "true" : "false"}
      data-scene-active={active ? "true" : "false"}
      data-scene-mode={renderScene ? "webgl" : "fallback"}
      data-scene-zone={zone}
    >
      {renderScene ? (
        <div className={styles.canvasWrap} aria-hidden="true">
          {!sceneReady ? <StaticGlassWord /> : null}
          <PortfolioGlassScene
            active={active}
            compact={compact}
            interaction={interaction}
            onContactChange={setContact}
            onReady={markSceneReady}
            registerFrameRequester={registerFrameRequester}
          />
        </div>
      ) : <StaticGlassWord />}
      <figcaption className={styles.srOnly}>BUILD, rendered as a clear glass word.</figcaption>
    </figure>
  );
}
