import { useEffect, useRef, useState } from "react";

import ANIMATION_CONSTANTS from "../constants/animationConstants";
import { cn } from "../utils/cn";

type TypewriterTextProps = {
  text: string;
  isDay: boolean;
};

const TypewriterText = ({ text, isDay }: TypewriterTextProps) => {
  const [displayText, setDisplayText] = useState(text);
  const [isAnimating, setIsAnimating] = useState(false);
  const prevTextRef = useRef(text);
  const timeoutRef = useRef<number>();
  const intervalRef = useRef<number>();

  useEffect(() => {
    // Only trigger animation if text actually changed
    if (prevTextRef.current === text) return;

    const previousText = prevTextRef.current;
    prevTextRef.current = text;

    // Clear any existing timers
    if (timeoutRef.current) window.clearTimeout(timeoutRef.current);
    if (intervalRef.current) window.clearInterval(intervalRef.current);

    setIsAnimating(true);

    // Delete animation: remove characters one by one
    let deleteIndex = previousText.length;
    intervalRef.current = window.setInterval(() => {
      if (deleteIndex > 0) {
        setDisplayText(previousText.slice(0, deleteIndex - 1));
        deleteIndex--;
      } else {
        if (intervalRef.current) window.clearInterval(intervalRef.current);
        intervalRef.current = undefined;

        // Small pause before typing new text
        timeoutRef.current = window.setTimeout(() => {
          timeoutRef.current = undefined;
          // Type animation: add characters one by one
          let typeIndex = 0;
          intervalRef.current = window.setInterval(() => {
            if (typeIndex <= text.length) {
              setDisplayText(text.slice(0, typeIndex));
              typeIndex++;
            } else {
              if (intervalRef.current) window.clearInterval(intervalRef.current);
              intervalRef.current = undefined;
              setIsAnimating(false);
            }
          }, ANIMATION_CONSTANTS.TYPEWRITER_TYPE_SPEED);
        }, ANIMATION_CONSTANTS.TYPEWRITER_PAUSE);
      }
    }, ANIMATION_CONSTANTS.TYPEWRITER_DELETE_SPEED);

    return () => {
      if (intervalRef.current) window.clearInterval(intervalRef.current);
      if (timeoutRef.current) window.clearTimeout(timeoutRef.current);
    };
  }, [text]);

  return (
    <div
      className={cn(
        "text-5xl font-bold drop-shadow-2xl tracking-wide",
        ANIMATION_CONSTANTS.PHASE_TRANSITION_CSS,
        isDay ? "text-yellow-100" : "text-blue-100"
      )}
    >
      <span className="inline-block">
        {displayText}
        <span
          className={cn(
            "inline-block w-1 h-12 ml-2 bg-current transition-opacity duration-300",
            isAnimating ? "opacity-100 animate-blink-cursor" : "opacity-0"
          )}
        />
      </span>
    </div>
  );
};

export default TypewriterText;
