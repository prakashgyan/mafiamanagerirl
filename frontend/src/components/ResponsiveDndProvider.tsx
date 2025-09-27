import { ReactNode, useEffect, useMemo, useState } from "react";
import { DndProvider } from "react-dnd";
import { HTML5Backend } from "react-dnd-html5-backend";
import { TouchBackend } from "react-dnd-touch-backend";

const isTouchEnvironment = () => {
  if (typeof window === "undefined") return false;
  if ("maxTouchPoints" in navigator && navigator.maxTouchPoints > 0) {
    return navigator.maxTouchPoints > 0;
  }
  if ("msMaxTouchPoints" in navigator) {
    return (navigator as Navigator & { msMaxTouchPoints: number }).msMaxTouchPoints > 0;
  }
  try {
    return window.matchMedia("(pointer: coarse)").matches;
  } catch {
    return false;
  }
};

type ResponsiveDndProviderProps = {
  children: ReactNode;
};

const ResponsiveDndProvider = ({ children }: ResponsiveDndProviderProps) => {
  const [touch, setTouch] = useState<boolean>(() => isTouchEnvironment());

  useEffect(() => {
    if (typeof window === "undefined") return;

    const query = window.matchMedia("(pointer: coarse)");
    const handleChange = () => setTouch(isTouchEnvironment());

    query.addEventListener?.("change", handleChange);

    window.addEventListener("touchstart", handleChange, { passive: true });

    return () => {
      query.removeEventListener?.("change", handleChange);
      window.removeEventListener("touchstart", handleChange);
    };
  }, []);

  const backend = useMemo(() => (touch ? TouchBackend : HTML5Backend), [touch]);
  const options = useMemo(() => (touch ? { enableMouseEvents: true, delayTouchStart: 50 } : undefined), [touch]);

  return (
    <DndProvider backend={backend} options={options}>
      {children}
    </DndProvider>
  );
};

export default ResponsiveDndProvider;
