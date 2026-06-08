// Computes fixed per-seat positions for the public-view player stage.
// Seats are assigned once (by sorted player id) and never move — eliminated
// players simply grey out in their seat instead of jumping to another zone.

export type SeatArrangement = "circle" | "classroom";

export type SeatPosition = {
  leftPct: number;
  topPct: number;
  scale: number;
};

// More players on screen → smaller cards, so seats never overlap.
const scaleForCount = (count: number): number => {
  if (count <= 8) return 1;
  if (count >= 24) return 0.6;
  return 1 - ((count - 8) / 16) * 0.4;
};

// "circle" seating = seats run evenly around the perimeter of a rounded
// rectangle — a real table shape, not a smooth ellipse.
const TABLE_CENTER = { x: 50, y: 55 };
const TABLE_HALF = { width: 38, height: 29 };
const TABLE_CORNER_RADIUS = 12;

type PathSegment = {
  length: number;
  pointAt: (t: number) => { x: number; y: number };
};

const lineSegment = (from: { x: number; y: number }, to: { x: number; y: number }): PathSegment => ({
  length: Math.hypot(to.x - from.x, to.y - from.y),
  pointAt: (t) => ({ x: from.x + (to.x - from.x) * t, y: from.y + (to.y - from.y) * t }),
});

const arcSegment = (center: { x: number; y: number }, radius: number, startAngle: number): PathSegment => ({
  length: (Math.PI / 2) * radius,
  pointAt: (t) => {
    const angle = startAngle + t * (Math.PI / 2);
    return { x: center.x + radius * Math.cos(angle), y: center.y + radius * Math.sin(angle) };
  },
});

// Clockwise path starting at top-centre, mirroring the old circle's start point.
const buildTablePath = (): PathSegment[] => {
  const { x: cx, y: cy } = TABLE_CENTER;
  const { width: halfW, height: halfH } = TABLE_HALF;
  const r = Math.min(TABLE_CORNER_RADIUS, halfW, halfH);
  const top = cy - halfH;
  const bottom = cy + halfH;
  const left = cx - halfW;
  const right = cx + halfW;

  return [
    lineSegment({ x: cx, y: top }, { x: right - r, y: top }),
    arcSegment({ x: right - r, y: top + r }, r, -Math.PI / 2),
    lineSegment({ x: right, y: top + r }, { x: right, y: bottom - r }),
    arcSegment({ x: right - r, y: bottom - r }, r, 0),
    lineSegment({ x: right - r, y: bottom }, { x: left + r, y: bottom }),
    arcSegment({ x: left + r, y: bottom - r }, r, Math.PI / 2),
    lineSegment({ x: left, y: bottom - r }, { x: left, y: top + r }),
    arcSegment({ x: left + r, y: top + r }, r, Math.PI),
    lineSegment({ x: left + r, y: top }, { x: cx, y: top }),
  ];
};

const pointAtDistance = (segments: PathSegment[], distance: number): { x: number; y: number } => {
  let remaining = distance;
  for (let i = 0; i < segments.length; i++) {
    const segment = segments[i];
    if (remaining <= segment.length || i === segments.length - 1) {
      const t = segment.length > 0 ? remaining / segment.length : 0;
      return segment.pointAt(Math.min(1, Math.max(0, t)));
    }
    remaining -= segment.length;
  }
  return segments[0].pointAt(0);
};

const computeCircleSeats = (count: number): SeatPosition[] => {
  const scale = scaleForCount(count);
  const path = buildTablePath();
  const totalLength = path.reduce((sum, segment) => sum + segment.length, 0);
  return Array.from({ length: count }, (_, i) => {
    const { x, y } = pointAtDistance(path, (i / count) * totalLength);
    return { leftPct: x, topPct: y, scale };
  });
};

const GRID_BOUNDS = { xMin: 12, xMax: 88, yMin: 26, yMax: 88 };

const computeClassroomSeats = (count: number): SeatPosition[] => {
  const scale = scaleForCount(count);
  // Bias columns > rows so rows of "desks" read naturally on a landscape screen.
  const cols = Math.max(1, Math.ceil(Math.sqrt(count * 1.7)));
  const rows = Math.ceil(count / cols);
  const rowGap = rows > 1 ? (GRID_BOUNDS.yMax - GRID_BOUNDS.yMin) / (rows - 1) : 0;

  const seats: SeatPosition[] = [];
  let placed = 0;
  for (let row = 0; row < rows; row++) {
    const seatsInRow = Math.min(cols, count - placed);
    const colGap = seatsInRow > 1 ? (GRID_BOUNDS.xMax - GRID_BOUNDS.xMin) / (seatsInRow - 1) : 0;
    const rowWidth = colGap * (seatsInRow - 1);
    // Centre rows that have fewer seats than a full row (e.g. the back row).
    const rowStart = GRID_BOUNDS.xMin + (GRID_BOUNDS.xMax - GRID_BOUNDS.xMin - rowWidth) / 2;
    for (let col = 0; col < seatsInRow; col++) {
      seats.push({
        leftPct: seatsInRow > 1 ? rowStart + col * colGap : 50,
        topPct: rows > 1 ? GRID_BOUNDS.yMin + row * rowGap : (GRID_BOUNDS.yMin + GRID_BOUNDS.yMax) / 2,
        scale,
      });
      placed++;
    }
  }
  return seats;
};

export const computeSeats = (count: number, arrangement: SeatArrangement): SeatPosition[] => {
  if (count <= 0) return [];
  return arrangement === "circle" ? computeCircleSeats(count) : computeClassroomSeats(count);
};
