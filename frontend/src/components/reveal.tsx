"use client";

import { Children, isValidElement, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

/**
 * True from the first time the element scrolls into view onward — the
 * observer disconnects on the first hit, so scrolling back up and down
 * again never resets it.
 */
function useRevealed<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.15, rootMargin: "0px 0px -80px 0px" }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return { ref, visible };
}

/**
 * Fades and slides content up from below the first time it scrolls into
 * view. See `useRevealed` for the once-only behaviour.
 */
export function Reveal({
  children,
  className,
  delay = 0,
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
}) {
  const { ref, visible } = useRevealed<HTMLDivElement>();

  return (
    <div
      ref={ref}
      style={delay ? { transitionDelay: `${delay}ms` } : undefined}
      className={cn(
        "transition-all duration-700 ease-out motion-reduce:transition-none",
        visible ? "translate-y-0 opacity-100" : "translate-y-8 opacity-0",
        className
      )}
    >
      {children}
    </div>
  );
}

const STAGGER_STEP_MS = 80;
const STAGGER_MAX_MS = 480;

/**
 * Same fade-up-from-below entrance as `Reveal`, but applied per child with
 * an increasing delay — so a row of items lights up left-to-right (grid
 * reading order) instead of all appearing at once.
 */
export function RevealStagger({
  children,
  className,
  itemClassName,
}: {
  children: React.ReactNode;
  className?: string;
  itemClassName?: string;
}) {
  const { ref, visible } = useRevealed<HTMLDivElement>();
  const items = Children.toArray(children);

  return (
    <div ref={ref} className={className}>
      {items.map((child, index) => (
        <div
          key={isValidElement(child) && child.key !== null ? child.key : index}
          style={{ transitionDelay: `${Math.min(index * STAGGER_STEP_MS, STAGGER_MAX_MS)}ms` }}
          className={cn(
            "transition-all duration-700 ease-out motion-reduce:transition-none",
            visible ? "translate-y-0 opacity-100" : "translate-y-8 opacity-0",
            itemClassName
          )}
        >
          {child}
        </div>
      ))}
    </div>
  );
}
