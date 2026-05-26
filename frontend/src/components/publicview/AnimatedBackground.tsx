import { useMemo } from "react";

import ANIMATION_CONSTANTS from "../../constants/animationConstants";
import { cn } from "../../utils/cn";

type PhaseProps = { isDay: boolean };

export const Stars = ({ isDay }: PhaseProps) => {
  const stars = useMemo(
    () =>
      Array.from({ length: ANIMATION_CONSTANTS.STAR_COUNT }, (_, i) => ({
        id: i,
        x: Math.random() * 100,
        y: Math.random() * 100,
        size: Math.random() * 2 + 1,
        opacity: Math.random() * 0.8 + 0.2,
        twinkleDelay: Math.random() * 8,
        twinkleDuration: Math.random() * 4 + 3,
      })),
    []
  );

  return (
    <div
      className={cn(
        "absolute inset-0 overflow-hidden",
        ANIMATION_CONSTANTS.PHASE_TRANSITION_CSS,
        isDay ? "opacity-0" : "opacity-100"
      )}
    >
      {stars.map((star) => (
        <div
          key={star.id}
          className="absolute animate-twinkle"
          style={{
            left: `${star.x}%`,
            top: `${star.y}%`,
            width: `${star.size}px`,
            height: `${star.size}px`,
            opacity: star.opacity,
            animationDelay: `${star.twinkleDelay}s`,
            animationDuration: `${star.twinkleDuration}s`,
          }}
        >
          <div className="h-full w-full rounded-full bg-white shadow-sm shadow-white/50" />
        </div>
      ))}
    </div>
  );
};

export const Sun = ({ isDay }: PhaseProps) => (
  <div className="absolute top-16 right-16 w-0 h-0 pointer-events-none">
    <div
      className={`absolute -translate-x-1/2 -translate-y-1/2 ${isDay ? "animate-sun-rise" : "animate-sun-set"}`}
      style={{
        animationFillMode: "forwards",
        transformOrigin: "center center",
        transform: isDay
          ? `rotate(-120deg) translateX(${ANIMATION_CONSTANTS.SUN_MOON_ARC_DISTANCE}px) rotate(120deg) scale(0.8)`
          : `rotate(120deg) translateX(${ANIMATION_CONSTANTS.SUN_MOON_ARC_DISTANCE}px) rotate(-120deg) scale(1)`,
        opacity: isDay ? 0 : 1,
      }}
    >
      <div className="relative">
        <div
          className={`h-24 w-24 rounded-full bg-gradient-radial from-yellow-200 via-yellow-400 to-orange-500 shadow-lg shadow-yellow-400/50 ${
            isDay ? "animate-pulse" : ""
          }`}
          style={{ animationDuration: "4s" }}
        >
          <div className="h-full w-full rounded-full bg-gradient-to-br from-yellow-100/30 to-transparent" />
        </div>
      </div>
    </div>
  </div>
);

export const Moon = ({ isDay }: PhaseProps) => (
  <div className="absolute top-16 right-16 w-0 h-0 pointer-events-none">
    <div
      className={`absolute -translate-x-1/2 -translate-y-1/2 ${isDay ? "animate-moon-set" : "animate-moon-rise"}`}
      style={{
        animationFillMode: "forwards",
        transformOrigin: "center center",
        transform: isDay
          ? `rotate(120deg) translateX(${ANIMATION_CONSTANTS.MOON_ARC_DISTANCE}px) rotate(-120deg) scale(1)`
          : `rotate(-120deg) translateX(${ANIMATION_CONSTANTS.MOON_ARC_DISTANCE}px) rotate(120deg) scale(0.8)`,
        opacity: isDay ? 1 : 0,
      }}
    >
      <div className="relative h-20 w-20">
        <div className="absolute -inset-4 rounded-full bg-blue-200/10 blur-xl animate-pulse" />
        <div className="relative h-full w-full rounded-full bg-gradient-to-br from-slate-200 via-slate-300 to-slate-400 shadow-lg shadow-blue-200/30">
          <div className="absolute left-3 top-2 h-2 w-2 rounded-full bg-slate-400/50" />
          <div className="absolute right-4 top-4 h-1 w-1 rounded-full bg-slate-400/50" />
          <div className="absolute bottom-3 left-5 h-1.5 w-1.5 rounded-full bg-slate-400/50" />
        </div>
      </div>
    </div>
  </div>
);

export const Clouds = ({ isDay }: PhaseProps) => {
  const clouds = useMemo(
    () =>
      Array.from({ length: ANIMATION_CONSTANTS.CLOUD_COUNT }, (_, i) => ({
        id: i,
        x: Math.random() * 220 - 20,
        y: Math.random() * 30 + 10,
        scale: Math.random() * 0.5 + 0.5,
        speed: Math.random() * 80 + 80,
        delay: Math.random() * 5,
      })),
    []
  );

  return (
    <div className="absolute inset-0 overflow-hidden">
      {clouds.map((cloud) => (
        <div
          key={cloud.id}
          className="absolute animate-drift"
          style={{
            left: `${cloud.x}%`,
            top: `${cloud.y}%`,
            transform: `scale(${cloud.scale})`,
            animationDuration: `${cloud.speed}s`,
            animationDelay: `${cloud.delay}s`,
          }}
        >
          <svg
            width="80"
            height="40"
            viewBox="0 0 80 40"
            className={cn(
              ANIMATION_CONSTANTS.PHASE_TRANSITION_CSS,
              isDay ? "text-white/70" : "text-slate-700/50"
            )}
            style={{ fill: "currentColor" }}
          >
            <path d="M20 30c-6 0-10-4-10-10s4-10 10-10c2-6 8-10 15-10s13 4 15 10c6 0 10 4 10 10s-4 10-10 10H20z" />
          </svg>
        </div>
      ))}
    </div>
  );
};

export const FloatingParticles = ({ isDay }: PhaseProps) => {
  const particles = useMemo(
    () =>
      Array.from({ length: ANIMATION_CONSTANTS.PARTICLE_COUNT }, (_, i) => ({
        id: i,
        x: Math.random() * 100,
        y: Math.random() * 100,
        size: Math.random() * 4 + 2,
        duration: Math.random() * 10 + 10,
        delay: Math.random() * 5,
      })),
    []
  );

  return (
    <div
      className={cn(
        "absolute inset-0 overflow-hidden",
        ANIMATION_CONSTANTS.PHASE_TRANSITION_CSS,
        isDay ? "opacity-60" : "opacity-30"
      )}
    >
      {particles.map((particle) => (
        <div
          key={particle.id}
          className={cn(
            "absolute animate-float rounded-full blur-sm",
            ANIMATION_CONSTANTS.PHASE_TRANSITION_CSS,
            isDay ? "bg-yellow-200" : "bg-blue-200"
          )}
          style={{
            left: `${particle.x}%`,
            top: `${particle.y}%`,
            width: `${particle.size}px`,
            height: `${particle.size}px`,
            animationDuration: `${particle.duration}s`,
            animationDelay: `${particle.delay}s`,
          }}
        />
      ))}
    </div>
  );
};
