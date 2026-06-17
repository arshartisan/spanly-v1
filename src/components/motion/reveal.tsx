"use client";

import { motion, useReducedMotion, type HTMLMotionProps } from "motion/react";

/**
 * Entrance-animation primitives following Emil Kowalski's principles: subtle (small rise +
 * fade), fast, one consistent ease-out spring curve, and fully disabled under reduced motion.
 *
 * - <Reveal>        - a single element eases in on mount (optional delay).
 * - <Stagger>       - a container whose <StaggerItem> children cascade in sequence.
 * - <StaggerItem>   - one cascading child (use inside <Stagger>).
 */

const EASE = [0.32, 0.72, 0, 1] as const;

export function Reveal({
  delay = 0,
  y = 8,
  duration = 0.4,
  children,
  ...props
}: HTMLMotionProps<"div"> & { delay?: number; y?: number; duration?: number }) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      initial={reduce ? false : { opacity: 0, y }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration, ease: EASE, delay }}
      {...props}
    >
      {children}
    </motion.div>
  );
}

export function Stagger({
  stagger = 0.05,
  delayChildren = 0.02,
  children,
  ...props
}: HTMLMotionProps<"div"> & { stagger?: number; delayChildren?: number }) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      initial="hidden"
      animate="show"
      variants={{
        hidden: {},
        show: {
          transition: {
            staggerChildren: reduce ? 0 : stagger,
            delayChildren: reduce ? 0 : delayChildren,
          },
        },
      }}
      {...props}
    >
      {children}
    </motion.div>
  );
}

export function StaggerItem({
  y = 10,
  children,
  ...props
}: HTMLMotionProps<"div"> & { y?: number }) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      variants={{
        hidden: reduce ? { opacity: 0 } : { opacity: 0, y },
        show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: EASE } },
      }}
      {...props}
    >
      {children}
    </motion.div>
  );
}
