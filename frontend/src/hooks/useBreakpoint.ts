import { useEffect, useMemo, useState } from "react";

type BreakpointKey = "xxs" | "xs" | "sm" | "md" | "lg" | "xl" | "2xl";

type BreakpointConfig = Record<BreakpointKey, number>;

const BREAKPOINTS: BreakpointConfig = {
  xxs: 320,
  xs: 380,
  sm: 640,
  md: 768,
  lg: 1024,
  xl: 1280,
  "2xl": 1536,
};

type BreakpointState = {
  key: BreakpointKey;
  up: Record<BreakpointKey, boolean>;
  down: Record<BreakpointKey, boolean>;
  between: (min: BreakpointKey, max: BreakpointKey) => boolean;
};

const orderedKeys: BreakpointKey[] = ["xxs", "xs", "sm", "md", "lg", "xl", "2xl"];

const getBreakpointKey = (width: number): BreakpointKey => {
  let current: BreakpointKey = "xxs";
  for (const key of orderedKeys) {
    if (width >= BREAKPOINTS[key]) {
      current = key;
    } else {
      break;
    }
  }
  return current;
};

export const useBreakpoint = (): BreakpointState => {
  const [width, setWidth] = useState<number>(() => (typeof window === "undefined" ? BREAKPOINTS.sm : window.innerWidth));

  useEffect(() => {
    if (typeof window === "undefined") return;

    let animationFrame: number;
    const handleResize = () => {
      cancelAnimationFrame(animationFrame);
      animationFrame = window.requestAnimationFrame(() => setWidth(window.innerWidth));
    };

    window.addEventListener("resize", handleResize);
    window.addEventListener("orientationchange", handleResize);
    return () => {
      cancelAnimationFrame(animationFrame);
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("orientationchange", handleResize);
    };
  }, []);

  return useMemo(() => {
    const key = getBreakpointKey(width);
    const up = orderedKeys.reduce<Record<BreakpointKey, boolean>>((acc, bpKey) => {
      acc[bpKey] = width >= BREAKPOINTS[bpKey];
      return acc;
    }, {} as Record<BreakpointKey, boolean>);

    const down = orderedKeys.reduce<Record<BreakpointKey, boolean>>((acc, bpKey) => {
      acc[bpKey] = width < BREAKPOINTS[bpKey];
      return acc;
    }, {} as Record<BreakpointKey, boolean>);

    const between = (min: BreakpointKey, max: BreakpointKey) => {
      const minIndex = orderedKeys.indexOf(min);
      const maxIndex = orderedKeys.indexOf(max);
      if (minIndex === -1 || maxIndex === -1 || minIndex > maxIndex) {
        return false;
      }
      const minWidth = BREAKPOINTS[min];
      const maxWidth = BREAKPOINTS[max];
      return width >= minWidth && width < maxWidth;
    };

    return {
      key,
      up,
      down,
      between,
    };
  }, [width]);
};

export const useIsCompact = (max: BreakpointKey = "sm") => {
  const breakpoint = useBreakpoint();
  return breakpoint.down[max];
};
