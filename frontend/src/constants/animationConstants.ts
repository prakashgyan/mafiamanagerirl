const ANIMATION_CONSTANTS = {
  PHASE_TRANSITION_DURATION: 8000, // ms - Standard transition time for all phase changes
  PHASE_TRANSITION_CSS: 'transition-all duration-[8000ms] ease-in-out', // Consistent CSS class
  TYPEWRITER_DELETE_SPEED: 80, // ms
  TYPEWRITER_TYPE_SPEED: 120, // ms
  TYPEWRITER_PAUSE: 300, // ms
  STAR_COUNT: 100,
  CLOUD_COUNT: 6,
  PARTICLE_COUNT: 20,
  SUN_MOON_ARC_DISTANCE: 300, // px
  MOON_ARC_DISTANCE: 250, // px
} as const;

export default ANIMATION_CONSTANTS;
