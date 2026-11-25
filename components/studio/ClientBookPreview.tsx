"use client";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import Image from "next/image";
import s from "./studio.module.css";
type Surface = { id: string; width: number; height: number };
type Turn = { from: number; to: number; forward: boolean };

// Match the desktop reader: clipped halves of the actual preview, a two-sided
// leaf and the same 820ms easing. Never reflow or crop uploaded book content.
export default function ClientBookPreview({
  base,
  spreads,
  index,
  onNavigate,
  onError,
  disabled = false,
  pinMode = false,
  pins = [],
  selectedPin,
  onPin,
  onViewed,
}: {
  base: string;
  spreads: Surface[];
  index: number;
  onNavigate: (index: number) => void;
  onError: () => void;
  disabled?: boolean;
  pinMode?: boolean;
  pins?: { id: string; x: number; y: number; label: string }[];
  selectedPin?: { x: number; y: number } | null;
  onPin?: (pin: { x: number; y: number }) => void;
  onViewed?: (index: number) => void;
}) {
  const [turn, setTurn] = useState<Turn | null>(null),
    [loading, setLoading] = useState(false),
    [reduced, setReduced] = useState(false),
    [loadedSource, setLoadedSource] = useState("");
  const book = useRef<HTMLDivElement>(null);
  const leaf = useRef<HTMLDivElement>(null),
    pointer = useRef<{ id: number; x: number; y: number } | null>(null),
    request = useRef(0),
    locked = useRef(false);
  const source = (i: number) => `${base}/media/${i}`;
  useEffect(() => {
    if (!book.current || loadedSource !== `${base}/media/${index}` || !onViewed)
      return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (
          entries.some(
            (entry) => entry.isIntersecting && entry.intersectionRatio >= 0.5,
          )
        ) {
          onViewed(index);
          observer.disconnect();
        }
      },
      { threshold: 0.5 },
    );
    observer.observe(book.current);
    return () => observer.disconnect();
  }, [base, index, loadedSource, onViewed]);
  useEffect(() => {
    const query = matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);
  useEffect(
    () => () => {
      request.current++;
    },
    [],
  );
  useLayoutEffect(() => {
    if (!turn || reduced || turn.to !== index || !leaf.current) {
      locked.current = false;
      return;
    }
    locked.current = true;
    const animation = leaf.current.animate(
      [
        { transform: "rotateY(0deg)" },
        { transform: `rotateY(${turn.forward ? -180 : 180}deg)` },
      ],
      {
        duration: 820,
        easing: "cubic-bezier(.38,.08,.22,1)",
        fill: "forwards",
      },
    );
    animation.oncancel = () => {
      locked.current = false;
      setTurn((current) => (current === turn ? null : current));
    };
    animation.onfinish = () => {
      locked.current = false;
      setTurn(null);
    };
    return () => {
      animation.onfinish = null;
      animation.cancel();
      locked.current = false;
    };
  }, [turn, reduced, index]);
  // Warm only adjacent private previews. Failures are reported on navigation,
  // without blanking the current page or fetching the whole book at once.
  useEffect(() => {
    for (const i of [index - 1, index + 1])
      if (spreads[i]) {
        const image = new window.Image();
        image.src = `${base}/media/${i}`;
      }
  }, [base, index, spreads]);
  async function navigate(direction: number) {
    const next = index + direction;
    if (disabled || locked.current || !spreads[next]) return;
    locked.current = true;
    setLoading(true);
    const sequence = ++request.current;
    try {
      const image = new window.Image();
      image.src = source(next);
      await image.decode();
      if (sequence !== request.current) return;
      if (!reduced) setTurn({ from: index, to: next, forward: next > index });
      onNavigate(next);
      if (reduced) locked.current = false;
    } catch {
      if (sequence === request.current) {
        locked.current = false;
        onError();
      }
    } finally {
      if (sequence === request.current) setLoading(false);
    }
  }
  const turning = Boolean(turn && !reduced && turn.to === index);
  const spread = spreads[index];
  if (!spread) return null;
  // Covers have one-page proportions. Keep them centred at their true aspect
  // ratio inside the same book surface rather than stretching them to a spread.
  const ratio = Math.max(...spreads.map((v) => v.width / v.height));
  const picture = (i: number) => (
    <Image
      unoptimized
      width={spreads[i].width}
      height={spreads[i].height}
      src={source(i)}
      alt=""
      draggable={false}
      className={s.bookImage}
    />
  );
  const face = (i: number, side: "left" | "right") => (
    <div
      className={`${s.pageContent} ${side === "left" ? s.pageLeft : s.pageRight}`}
    >
      {picture(i)}
    </div>
  );
  return (
    <div
      className={s.bookReader}
      onKeyDown={(event) => {
        if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
          event.preventDefault();
          void navigate(event.key === "ArrowLeft" ? -1 : 1);
        }
      }}
    >
      <div className={s.bookStage}>
        <div
          className={s.book}
          ref={book}
          style={{
            aspectRatio: ratio,
            maxWidth: `min(100%, calc(70svh * ${ratio}))`,
          }}
          data-turning={turn ? (turn.forward ? "forward" : "backward") : "idle"}
          tabIndex={0}
          role="group"
          aria-label={`Book preview ${index + 1} of ${spreads.length}. Use arrow keys to turn pages.`}
          aria-busy={loading}
          onPointerDown={(event) => {
            if (pinMode || event.button !== 0 || locked.current || disabled)
              return;
            pointer.current = {
              id: event.pointerId,
              x: event.clientX,
              y: event.clientY,
            };
            event.currentTarget.setPointerCapture(event.pointerId);
          }}
          onPointerUp={(event) => {
            const start = pointer.current;
            pointer.current = null;
            if (!start || start.id !== event.pointerId) return;
            const dx = event.clientX - start.x,
              dy = event.clientY - start.y;
            if (Math.abs(dx) > 45 && Math.abs(dx) > Math.abs(dy))
              void navigate(dx < 0 ? 1 : -1);
            else if (Math.abs(dx) < 8 && Math.abs(dy) < 8) {
              const bounds = event.currentTarget.getBoundingClientRect(),
                position = (event.clientX - bounds.left) / bounds.width;
              if (position < 0.2) void navigate(-1);
              if (position > 0.8) void navigate(1);
            }
          }}
          onPointerCancel={() => {
            pointer.current = null;
          }}
          onLostPointerCapture={() => {
            pointer.current = null;
          }}
        >
          <div className={s.restingSpread}>
            <Image
              unoptimized
              width={spread.width}
              height={spread.height}
              src={source(index)}
              alt={`Book preview ${index + 1} of ${spreads.length}`}
              draggable={false}
              className={s.bookImage}
              onError={onError}
              onLoad={() => setLoadedSource(source(index))}
            />
          </div>
          {!turning && (
            <div
              className={s.pinLayer}
              style={{
                width: `${(spread.width / spread.height / ratio) * 100}%`,
                pointerEvents: pinMode ? "auto" : "none",
              }}
              onClick={(event) => {
                if (!pinMode || disabled) return;
                const bounds = event.currentTarget.getBoundingClientRect();
                onPin?.({
                  x: Math.max(
                    0,
                    Math.min(1, (event.clientX - bounds.left) / bounds.width),
                  ),
                  y: Math.max(
                    0,
                    Math.min(1, (event.clientY - bounds.top) / bounds.height),
                  ),
                });
              }}
            >
              {pins.map((pin, i) => (
                <span
                  key={pin.id}
                  className={s.pin}
                  style={{ left: `${pin.x * 100}%`, top: `${pin.y * 100}%` }}
                  title={pin.label}
                  aria-label={pin.label}
                >
                  {i + 1}
                </span>
              ))}
              {selectedPin && (
                <span
                  className={`${s.pin} ${s.draftPin}`}
                  style={{
                    left: `${selectedPin.x * 100}%`,
                    top: `${selectedPin.y * 100}%`,
                  }}
                  aria-label="New feedback location"
                >
                  +
                </span>
              )}
            </div>
          )}
          {turn && !reduced && turn.to === index && (
            <div className={s.turnLayers} aria-hidden="true">
              <div
                className={`${s.stationaryPage} ${turn.forward ? s.left : s.right}`}
              >
                {face(turn.from, turn.forward ? "left" : "right")}
              </div>
              <div
                ref={leaf}
                className={`${s.turningPage} ${turn.forward ? s.forward : s.backward}`}
              >
                <div className={s.leafFront}>
                  {face(turn.from, turn.forward ? "right" : "left")}
                  <div className={s.leafShading} />
                </div>
                <div className={s.leafBack}>
                  {face(turn.to, turn.forward ? "left" : "right")}
                  <div className={s.leafShading} />
                </div>
              </div>
            </div>
          )}
          <div className={s.spine} aria-hidden="true" />
        </div>
      </div>
      <nav className={s.navigation} aria-label="Book review pages">
        <button
          className={s.button}
          disabled={index === 0 || disabled || loading || turning}
          onClick={() => void navigate(-1)}
        >
          ← Previous
        </button>
        <span aria-live="polite" aria-atomic="true">
          {loading ? "Loading page…" : `${index + 1} / ${spreads.length}`}
        </span>
        <button
          className={s.button}
          disabled={
            index >= spreads.length - 1 || disabled || loading || turning
          }
          onClick={() => void navigate(1)}
        >
          Next →
        </button>
      </nav>
    </div>
  );
}
