export type Point = { x: number; y: number };

export type ShapeKind =
  | "line"
  | "circle"
  | "rectangle"
  | "triangle"
  | "arrow";

export type RecognitionResult = {
  type: ShapeKind;
  label: string;
  confidence: number;
  points: Point[];
  center?: Point;
  radiusX?: number;
  radiusY?: number;
  rotation?: number;
};

const MIN_DIAG = 14;
const MIN_PATH = 16;
const CONFIDENCE_FLOOR = 0.5;

export function recognizeShape(raw: Point[]): RecognitionResult | null {
  try {
    return recognizeShapeUnsafe(raw);
  } catch {
    return null;
  }
}

function recognizeShapeUnsafe(raw: Point[]): RecognitionResult | null {
  const filtered = densify(filterClose(raw, 0.8));
  if (filtered.length < 2) return null;

  const resampled = resample(filtered, 64);
  const smoothed = smooth(resampled, 1);
  const pathLen = pathLength(smoothed);
  const bounds = boundingBox(smoothed);
  const width = Math.max(1, bounds.maxX - bounds.minX);
  const height = Math.max(1, bounds.maxY - bounds.minY);
  const diag = Math.hypot(width, height);

  if (diag < MIN_DIAG && pathLen < MIN_PATH) return null;

  const start = smoothed[0];
  const end = smoothed[smoothed.length - 1];
  const endDist = distance(start, end);
  const straightness = endDist / Math.max(pathLen, 1);
  const meanLineErr = meanPerpendicular(smoothed, start, end);
  const lineRms = rmsPerpendicular(smoothed, start, end) / Math.max(diag, 1);
  const closed =
    endDist < Math.max(28, diag * 0.28) && pathLen > diag * 1.3;

  const center = centroid(smoothed);
  const radii = smoothed.map((p) => distance(p, center));
  const meanR = average(radii);
  const radiusCv = meanR > 1 ? stddev(radii) / meanR : 1;
  const hull = convexHull(smoothed);
  const hullArea = Math.abs(polygonArea(hull));
  const directions = analyzeDirections(smoothed);

  const candidates: RecognitionResult[] = [];

  const line = scoreLine(
    start,
    end,
    straightness,
    meanLineErr,
    lineRms,
    width,
    height,
    diag,
    closed
  );
  if (line) candidates.push(line);

  const arrow = scoreArrow(smoothed, pathLen, straightness, lineRms, closed);
  if (arrow && !(line && line.confidence >= arrow.confidence - 0.05)) {
    candidates.push(arrow);
  }

  if (closed) {
    const circle = scoreCircle(
      smoothed,
      center,
      meanR,
      radiusCv,
      bounds,
      width,
      height,
      directions,
      hullArea
    );
    if (circle) candidates.push(circle);

    const rectFit = fitRectangle(hull, bounds, smoothed, directions);
    if (rectFit) candidates.push(rectFit);

    const triFit = fitTriangle(hull, smoothed);
    if (triFit) candidates.push(triFit);

    const poly = fallbackPolygon(smoothed, diag, bounds);
    if (poly) candidates.push(poly);
  }

  if (candidates.length === 0) return null;

  candidates.sort((a, b) => b.confidence - a.confidence);
  const best = candidates[0];
  const second = candidates[1];

  if (best.confidence < CONFIDENCE_FLOOR) return null;

  if (best.type === "line" && (!second || best.confidence + 0.04 >= second.confidence)) {
    return best;
  }

  if (
    second &&
    best.type === "circle" &&
    second.type === "rectangle" &&
    best.confidence - second.confidence < 0.06 &&
    radiusCv > 0.12
  ) {
    return second.confidence >= CONFIDENCE_FLOOR ? second : best;
  }

  if (
    second &&
    best.type === "rectangle" &&
    second.type === "circle" &&
    radiusCv < 0.1 &&
    second.confidence >= CONFIDENCE_FLOOR
  ) {
    return second;
  }

  return best;
}

function scoreLine(
  start: Point,
  end: Point,
  straightness: number,
  meanLineErr: number,
  lineRms: number,
  width: number,
  height: number,
  diag: number,
  closed: boolean
): RecognitionResult | null {
  if (closed) return null;

  const thin = Math.min(width, height) / Math.max(width, height, 1);
  const relErr = meanLineErr / Math.max(diag, 1);
  const looksStraight =
    (straightness >= 0.62 && relErr <= 0.16) ||
    (straightness >= 0.7 && meanLineErr <= Math.max(16, diag * 0.14)) ||
    (thin <= 0.38 && straightness >= 0.55) ||
    (lineRms <= 0.12 && straightness >= 0.68);

  if (!looksStraight) return null;

  const snapped = snapLine(start, end);
  const confidence = clamp(
    0.78 + (straightness - 0.62) * 0.35 + Math.max(0, 0.16 - relErr),
    0.78,
    0.99
  );

  return {
    type: "line",
    label: "Line",
    confidence,
    points: [snapped.start, snapped.end],
  };
}

function scoreArrow(
  points: Point[],
  _pathLen: number,
  straightness: number,
  lineRms: number,
  closed: boolean
): RecognitionResult | null {
  if (closed || points.length < 16) return null;

  const start = points[0];
  let tipIndex = 0;
  let tipDist = -1;
  for (let i = 0; i < points.length; i++) {
    const d = distance(start, points[i]);
    if (d > tipDist) {
      tipDist = d;
      tipIndex = i;
    }
  }

  const remainingRatio = (points.length - 1 - tipIndex) / (points.length - 1);
  const tipRatio = tipIndex / (points.length - 1);

  const window = 8;
  let maxTurn = 0;
  let turnIndex = tipIndex;
  const searchFrom = Math.floor(points.length * 0.4);
  for (let i = searchFrom; i < points.length - 1; i++) {
    const turn = headingChange(
      points[Math.max(0, i - window)],
      points[i],
      points[Math.min(points.length - 1, i + window)]
    );
    if (turn > maxTurn) {
      maxTurn = turn;
      turnIndex = i;
    }
  }

  if (tipRatio < 0.42) return null;
  if (remainingRatio < 0.05 || remainingRatio > 0.55) return null;
  if (maxTurn < 70) return null;
  if (Math.abs(turnIndex - tipIndex) > points.length * 0.22) return null;

  const tip = points[tipIndex];
  const shaft = points.slice(0, tipIndex + 1);
  if (shaft.length < 8) return null;

  const shaftLen = pathLength(shaft);
  const shaftStraight = distance(start, tip) / Math.max(shaftLen, 1);
  const shaftRms =
    rmsPerpendicular(shaft, start, tip) / Math.max(distance(start, tip), 1);

  if (shaftStraight < 0.78 || shaftRms > 0.12) return null;

  const hook = points.slice(tipIndex);
  const hookLen = pathLength(hook);
  if (hookLen < Math.max(12, shaftLen * 0.08)) return null;

  const hookEnd = points[points.length - 1];
  const shaftVec = normalize(sub(tip, start));
  const hookVec = normalize(sub(hookEnd, tip));
  const forward = dot(shaftVec, hookVec);

  if (forward > 0.2) return null;

  const confidence = clamp(
    0.55 +
      (shaftStraight - 0.78) * 1.1 +
      (0.12 - shaftRms) * 1.4 +
      Math.min(0.2, remainingRatio) +
      Math.min(0.15, (maxTurn - 70) / 180),
    0,
    0.97
  );

  if (confidence < CONFIDENCE_FLOOR) return null;
  if (straightness > 0.94 && lineRms < 0.025 && remainingRatio < 0.08) {
    return null;
  }

  const snapped = snapLine(start, tip);

  return {
    type: "arrow",
    label: "Arrow",
    confidence,
    points: [snapped.start, snapped.end],
  };
}

function scoreCircle(
  points: Point[],
  _center: Point,
  meanR: number,
  radiusCv: number,
  _bounds: Bounds,
  width: number,
  height: number,
  directions: DirectionAnalysis,
  hullArea: number
): RecognitionResult | null {
  if (meanR < 10) return null;

  const aspect = Math.min(width, height) / Math.max(width, height);
  if (aspect > 0.68 && radiusCv <= 0.18 && directions.maxWeight < 0.28) {
    const ellipse = fitEllipse(points);
    const useCircle = ellipse.ratio > 0.82;
    return {
      type: "circle",
      label: useCircle ? "Circle" : "Ellipse",
      confidence: 0.84,
      points: [],
      center: ellipse.center,
      radiusX: useCircle ? (ellipse.rx + ellipse.ry) / 2 : ellipse.rx,
      radiusY: useCircle ? (ellipse.rx + ellipse.ry) / 2 : ellipse.ry,
      rotation: useCircle ? 0 : ellipse.rotation,
    };
  }

  const ellipse = fitEllipse(points);
  const residual = ellipseResidual(points, ellipse);
  const goodEllipse = residual < 0.16 && ellipse.ratio > 0.32;

  if (!goodEllipse) {
    if (radiusCv > 0.2) return null;
    if (directions.peakCount >= 2 && directions.maxWeight > 0.3) return null;
    if (directions.peakCount >= 3 && directions.maxWeight > 0.22) return null;
  }

  const circleArea = Math.PI * meanR * meanR;
  const areaRatio =
    circleArea > 1
      ? Math.min(hullArea, circleArea) / Math.max(hullArea, circleArea)
      : 0;

  const circScore = goodEllipse
    ? clamp(1 - residual / 0.16, 0, 1)
    : clamp(1 - radiusCv / 0.2, 0, 1);
  const peakPenalty =
    !goodEllipse && directions.maxWeight > 0.22
      ? (directions.maxWeight - 0.22) * 1.4
      : 0;

  const confidence = clamp(
    0.34 +
      circScore * 0.5 +
      (goodEllipse ? 0.16 : areaRatio * 0.18) +
      (goodEllipse ? ellipse.ratio * 0.06 : aspect * 0.08) -
      peakPenalty,
    0,
    0.98
  );

  if (confidence < CONFIDENCE_FLOOR) return null;

  const useCircle = ellipse.ratio > 0.82;

  return {
    type: "circle",
    label: useCircle ? "Circle" : "Ellipse",
    confidence,
    points: [],
    center: ellipse.center,
    radiusX: useCircle ? (ellipse.rx + ellipse.ry) / 2 : ellipse.rx,
    radiusY: useCircle ? (ellipse.rx + ellipse.ry) / 2 : ellipse.ry,
    rotation: useCircle ? 0 : ellipse.rotation,
  };
}

function fitRectangle(
  hull: Point[],
  bounds: Bounds,
  sampled: Point[],
  directions: DirectionAnalysis
): RecognitionResult | null {
  if (hull.length < 3) return null;

  const fitted = minAreaRect(hull);
  if (!fitted) return null;

  const rectArea = Math.max(fitted.width * fitted.height, 1);
  const compactness = Math.abs(polygonArea(hull)) / rectArea;
  const structured =
    directions.peakCount >= 2 && directions.maxWeight > 0.24;

  if (compactness < 0.7) return null;
  if (compactness < 0.8 && !structured) return null;

  const minSide = Math.min(fitted.width, fitted.height);
  if (minSide < 10) return null;

  const fitError =
    meanDistanceToPolygon(sampled, fitted.corners) / Math.max(minSide, 1);
  if (fitError > 0.2) return null;

  const angles = cornerAngles(fitted.corners);
  const rightish = angles.filter((a) => Math.abs(a - 90) < 22).length;
  if (rightish < 3) return null;

  const aspect = minSide / Math.max(fitted.width, fitted.height);
  const axisAligned = isNearAxis(fitted.angle);

  const confidence = clamp(
    0.4 + compactness * 0.4 + (0.16 - fitError) * 1.5 + (rightish === 4 ? 0.08 : 0),
    0,
    0.97
  );

  if (confidence < CONFIDENCE_FLOOR) return null;

  let corners = fitted.corners;
  let label = "Rectangle";

  if (axisAligned) {
    const pad = 0;
    corners = [
      { x: bounds.minX - pad, y: bounds.minY - pad },
      { x: bounds.maxX + pad, y: bounds.minY - pad },
      { x: bounds.maxX + pad, y: bounds.maxY + pad },
      { x: bounds.minX - pad, y: bounds.maxY + pad },
    ];
    const w = bounds.maxX - bounds.minX;
    const h = bounds.maxY - bounds.minY;
    const a = Math.min(w, h) / Math.max(w, h);
    if (a > 0.86) {
      const side = (w + h) / 2;
      const cx = (bounds.minX + bounds.maxX) / 2;
      const cy = (bounds.minY + bounds.maxY) / 2;
      corners = [
        { x: cx - side / 2, y: cy - side / 2 },
        { x: cx + side / 2, y: cy - side / 2 },
        { x: cx + side / 2, y: cy + side / 2 },
        { x: cx - side / 2, y: cy + side / 2 },
      ];
      label = "Square";
    }
  } else if (aspect > 0.86) {
    const side = (fitted.width + fitted.height) / 2;
    corners = orientedRect(fitted.center, side, side, fitted.angle);
    label = "Square";
  }

  return {
    type: "rectangle",
    label,
    confidence,
    points: orderCorners(corners),
  };
}

function fitTriangle(hull: Point[], sampled: Point[]): RecognitionResult | null {
  if (hull.length < 3) return null;

  const tri = maxAreaTriangle(hull);
  if (!tri) return null;

  const hullArea = Math.abs(polygonArea(hull));
  const triArea = Math.abs(polygonArea(tri));
  if (hullArea < 1 || triArea < 80) return null;

  const fill = triArea / hullArea;
  if (fill < 0.68) return null;

  const sides = [
    distance(tri[0], tri[1]),
    distance(tri[1], tri[2]),
    distance(tri[2], tri[0]),
  ];
  const minSide = Math.min(...sides);
  if (minSide < 12) return null;

  const fitError = meanDistanceToPolygon(sampled, tri) / minSide;
  if (fitError > 0.22) return null;

  const angles = cornerAngles(tri);
  if (angles.some((a) => a < 16 || a > 150)) return null;

  const confidence = clamp(
    0.36 + fill * 0.4 + (0.18 - fitError) * 1.3,
    0,
    0.96
  );

  if (confidence < CONFIDENCE_FLOOR) return null;

  return {
    type: "triangle",
    label: "Triangle",
    confidence,
    points: orderCorners(tri),
  };
}

function fallbackPolygon(
  points: Point[],
  diag: number,
  bounds: Bounds
): RecognitionResult | null {
  const simplified = rdp(points, Math.max(8, diag * 0.045));
  if (simplified.length < 3) return null;

  const verts = [...simplified];
  if (distance(verts[0], verts[verts.length - 1]) < Math.max(18, diag * 0.12)) {
    verts.pop();
  }

  if (verts.length === 3) {
    return {
      type: "triangle",
      label: "Triangle",
      confidence: 0.74,
      points: orderCorners(verts),
    };
  }

  if (verts.length >= 4 && verts.length <= 6) {
    const corners = [
      { x: bounds.minX, y: bounds.minY },
      { x: bounds.maxX, y: bounds.minY },
      { x: bounds.maxX, y: bounds.maxY },
      { x: bounds.minX, y: bounds.maxY },
    ];
    const w = bounds.maxX - bounds.minX;
    const h = bounds.maxY - bounds.minY;
    const square = Math.min(w, h) / Math.max(w, h) > 0.86;
    return {
      type: "rectangle",
      label: square ? "Square" : "Rectangle",
      confidence: 0.7,
      points: square
        ? (() => {
            const side = (w + h) / 2;
            const cx = (bounds.minX + bounds.maxX) / 2;
            const cy = (bounds.minY + bounds.maxY) / 2;
            return [
              { x: cx - side / 2, y: cy - side / 2 },
              { x: cx + side / 2, y: cy - side / 2 },
              { x: cx + side / 2, y: cy + side / 2 },
              { x: cx - side / 2, y: cy + side / 2 },
            ];
          })()
        : corners,
    };
  }

  return null;
}

function rdp(points: Point[], epsilon: number): Point[] {
  if (points.length < 3) return points;
  let maxDist = 0;
  let index = 0;
  const first = points[0];
  const last = points[points.length - 1];
  for (let i = 1; i < points.length - 1; i++) {
    const d = perpendicularDistance(points[i], first, last);
    if (d > maxDist) {
      index = i;
      maxDist = d;
    }
  }
  if (maxDist > epsilon) {
    const left = rdp(points.slice(0, index + 1), epsilon);
    const right = rdp(points.slice(index), epsilon);
    return [...left.slice(0, -1), ...right];
  }
  return [first, last];
}

type Bounds = { minX: number; maxX: number; minY: number; maxY: number };

type DirectionAnalysis = {
  peakCount: number;
  maxWeight: number;
};

function analyzeDirections(points: Point[]): DirectionAnalysis {
  const bins = 12;
  const hist = new Array(bins).fill(0);
  let total = 0;

  for (let i = 1; i < points.length; i++) {
    const dx = points[i].x - points[i - 1].x;
    const dy = points[i].y - points[i - 1].y;
    const len = Math.hypot(dx, dy);
    if (len < 0.5) continue;
    let angle = Math.atan2(dy, dx);
    if (angle < 0) angle += Math.PI * 2;
    if (angle >= Math.PI) angle -= Math.PI;
    const bin = Math.min(bins - 1, Math.floor((angle / Math.PI) * bins));
    hist[bin] += len;
    total += len;
  }

  if (total < 1) return { peakCount: 0, maxWeight: 0 };

  const norm = hist.map((v) => v / total);
  const smoothed = norm.map((v, i) => {
    const prev = norm[(i + bins - 1) % bins];
    const next = norm[(i + 1) % bins];
    return 0.25 * prev + 0.5 * v + 0.25 * next;
  });

  const peaks: number[] = [];
  for (let i = 0; i < bins; i++) {
    const prev = smoothed[(i + bins - 1) % bins];
    const next = smoothed[(i + 1) % bins];
    if (smoothed[i] >= prev && smoothed[i] >= next && smoothed[i] >= 0.11) {
      peaks.push(i);
    }
  }

  return {
    peakCount: peaks.length,
    maxWeight: Math.max(...smoothed),
  };
}

function fitEllipse(points: Point[]) {
  const c = centroid(points);
  let sxx = 0;
  let sxy = 0;
  let syy = 0;
  for (const p of points) {
    const dx = p.x - c.x;
    const dy = p.y - c.y;
    sxx += dx * dx;
    sxy += dx * dy;
    syy += dy * dy;
  }
  const n = points.length;
  sxx /= n;
  sxy /= n;
  syy /= n;

  const trace = sxx + syy;
  const det = sxx * syy - sxy * sxy;
  const disc = Math.sqrt(Math.max(0, (trace * trace) / 4 - det));
  const l1 = trace / 2 + disc;
  const rotation =
    Math.abs(sxy) > 1e-6 ? Math.atan2(l1 - sxx, sxy) : sxx >= syy ? 0 : Math.PI / 2;

  let minU = Infinity;
  let maxU = -Infinity;
  let minV = Infinity;
  let maxV = -Infinity;
  const cos = Math.cos(-rotation);
  const sin = Math.sin(-rotation);
  for (const p of points) {
    const dx = p.x - c.x;
    const dy = p.y - c.y;
    const u = dx * cos - dy * sin;
    const v = dx * sin + dy * cos;
    minU = Math.min(minU, u);
    maxU = Math.max(maxU, u);
    minV = Math.min(minV, v);
    maxV = Math.max(maxV, v);
  }

  return {
    center: c,
    rx: Math.max(4, (maxU - minU) / 2),
    ry: Math.max(4, (maxV - minV) / 2),
    rotation,
    ratio: Math.min(maxU - minU, maxV - minV) / Math.max(maxU - minU, maxV - minV),
  };
}

function ellipseResidual(
  points: Point[],
  ellipse: { center: Point; rx: number; ry: number; rotation: number }
): number {
  const cos = Math.cos(-ellipse.rotation);
  const sin = Math.sin(-ellipse.rotation);
  let error = 0;
  for (const p of points) {
    const dx = p.x - ellipse.center.x;
    const dy = p.y - ellipse.center.y;
    const u = (dx * cos - dy * sin) / Math.max(ellipse.rx, 1);
    const v = (dx * sin + dy * cos) / Math.max(ellipse.ry, 1);
    error += Math.abs(Math.hypot(u, v) - 1);
  }
  return error / Math.max(points.length, 1);
}

function minAreaRect(hull: Point[]): {
  corners: Point[];
  width: number;
  height: number;
  angle: number;
  center: Point;
} | null {
  if (hull.length < 3) return null;

  let minArea = Infinity;
  let best: {
    corners: Point[];
    width: number;
    height: number;
    angle: number;
    center: Point;
  } | null = null;

  for (let i = 0; i < hull.length; i++) {
    const a = hull[i];
    const b = hull[(i + 1) % hull.length];
    const edge = sub(b, a);
    const len = Math.hypot(edge.x, edge.y);
    if (len < 1e-6) continue;
    const ux = edge.x / len;
    const uy = edge.y / len;
    const vx = -uy;
    const vy = ux;

    let minU = Infinity;
    let maxU = -Infinity;
    let minV = Infinity;
    let maxV = -Infinity;
    for (const p of hull) {
      const d = sub(p, a);
      const u = d.x * ux + d.y * uy;
      const v = d.x * vx + d.y * vy;
      minU = Math.min(minU, u);
      maxU = Math.max(maxU, u);
      minV = Math.min(minV, v);
      maxV = Math.max(maxV, v);
    }

    const width = maxU - minU;
    const height = maxV - minV;
    const area = width * height;
    if (area >= minArea) continue;

    minArea = area;
    const corners = [
      { x: a.x + ux * minU + vx * minV, y: a.y + uy * minU + vy * minV },
      { x: a.x + ux * maxU + vx * minV, y: a.y + uy * maxU + vy * minV },
      { x: a.x + ux * maxU + vx * maxV, y: a.y + uy * maxU + vy * maxV },
      { x: a.x + ux * minU + vx * maxV, y: a.y + uy * minU + vy * maxV },
    ];
    best = {
      corners,
      width,
      height,
      angle: Math.atan2(uy, ux),
      center: {
        x: a.x + ux * ((minU + maxU) / 2) + vx * ((minV + maxV) / 2),
        y: a.y + uy * ((minU + maxU) / 2) + vy * ((minV + maxV) / 2),
      },
    };
  }

  return best;
}

function maxAreaTriangle(hull: Point[]): Point[] | null {
  if (hull.length < 3) return null;
  if (hull.length === 3) return [...hull];

  let best = 0;
  let tri: Point[] = [hull[0], hull[1], hull[2]];

  for (let i = 0; i < hull.length; i++) {
    for (let j = i + 1; j < hull.length; j++) {
      for (let k = j + 1; k < hull.length; k++) {
        const area = Math.abs(polygonArea([hull[i], hull[j], hull[k]]));
        if (area > best) {
          best = area;
          tri = [hull[i], hull[j], hull[k]];
        }
      }
    }
  }

  return tri;
}

function orientedRect(
  center: Point,
  width: number,
  height: number,
  angle: number
): Point[] {
  const hw = width / 2;
  const hh = height / 2;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const local = [
    { x: -hw, y: -hh },
    { x: hw, y: -hh },
    { x: hw, y: hh },
    { x: -hw, y: hh },
  ];
  return local.map((p) => ({
    x: center.x + p.x * cos - p.y * sin,
    y: center.y + p.x * sin + p.y * cos,
  }));
}

function snapLine(start: Point, end: Point) {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const angle = Math.atan2(dy, dx);
  const deg = (angle * 180) / Math.PI;
  const snapped = Math.round(deg / 90) * 90;
  const delta = Math.abs(deg - snapped);

  if (delta > 15 && Math.abs(delta - 360) > 15) {
    return { start, end };
  }

  const len = Math.hypot(dx, dy);
  const rad = (snapped * Math.PI) / 180;
  return {
    start,
    end: {
      x: start.x + Math.cos(rad) * len,
      y: start.y + Math.sin(rad) * len,
    },
  };
}

function isNearAxis(angle: number) {
  const deg = (((angle * 180) / Math.PI) % 90 + 90) % 90;
  return deg < 12 || deg > 78;
}

function cornerAngles(poly: Point[]): number[] {
  const n = poly.length;
  const angles: number[] = [];
  for (let i = 0; i < n; i++) {
    angles.push(
      turningAngle(poly[(i + n - 1) % n], poly[i], poly[(i + 1) % n])
    );
  }
  return angles;
}

function orderCorners(points: Point[]): Point[] {
  const c = centroid(points);
  return [...points].sort(
    (a, b) => Math.atan2(a.y - c.y, a.x - c.x) - Math.atan2(b.y - c.y, b.x - c.x)
  );
}

function meanDistanceToPolygon(points: Point[], poly: Point[]): number {
  if (points.length === 0 || poly.length < 2) return Infinity;
  let total = 0;
  for (const p of points) {
    let min = Infinity;
    for (let i = 0; i < poly.length; i++) {
      min = Math.min(
        min,
        pointToSegmentDistance(p, poly[i], poly[(i + 1) % poly.length])
      );
    }
    total += min;
  }
  return total / points.length;
}

function pointToSegmentDistance(p: Point, a: Point, b: Point): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len2 = dx * dx + dy * dy;
  if (len2 < 1e-8) return distance(p, a);
  const t = clamp(((p.x - a.x) * dx + (p.y - a.y) * dy) / len2, 0, 1);
  return distance(p, { x: a.x + t * dx, y: a.y + t * dy });
}

function meanPerpendicular(points: Point[], a: Point, b: Point): number {
  if (points.length === 0) return 0;
  let sum = 0;
  for (const p of points) {
    sum += perpendicularDistance(p, a, b);
  }
  return sum / points.length;
}

function rmsPerpendicular(points: Point[], a: Point, b: Point): number {
  if (points.length === 0) return 0;
  let sum = 0;
  for (const p of points) {
    const d = perpendicularDistance(p, a, b);
    sum += d * d;
  }
  return Math.sqrt(sum / points.length);
}

export function resample(points: Point[], n: number): Point[] {
  if (points.length === 0) return [];
  if (n <= 1) return [points[0]];
  const total = pathLength(points);
  if (total === 0) return Array.from({ length: n }, () => ({ ...points[0] }));

  const interval = total / (n - 1);
  const result: Point[] = [{ ...points[0] }];
  let distanceCovered = 0;
  let i = 1;
  let guard = 0;
  const maxSteps = n * points.length + 8;

  while (result.length < n && i < points.length && guard < maxSteps) {
    guard += 1;
    const prev = points[i - 1];
    const curr = points[i];
    const seg = distance(prev, curr);
    if (seg < 1e-8) {
      i += 1;
      continue;
    }
    if (distanceCovered + seg >= interval * result.length) {
      const t = clamp(
        (interval * result.length - distanceCovered) / seg,
        0,
        1
      );
      result.push({
        x: prev.x + (curr.x - prev.x) * t,
        y: prev.y + (curr.y - prev.y) * t,
      });
      if (t >= 0.999) {
        distanceCovered += seg;
        i += 1;
      } else {
        distanceCovered += interval;
      }
    } else {
      distanceCovered += seg;
      i += 1;
    }
  }

  while (result.length < n) {
    result.push({ ...points[points.length - 1] });
  }

  return result;
}

function smooth(points: Point[], passes: number): Point[] {
  let current = points;
  for (let p = 0; p < passes; p++) {
    const next = current.map((pt, i) => {
      if (i === 0 || i === current.length - 1) return pt;
      return {
        x: current[i - 1].x * 0.25 + pt.x * 0.5 + current[i + 1].x * 0.25,
        y: current[i - 1].y * 0.25 + pt.y * 0.5 + current[i + 1].y * 0.25,
      };
    });
    current = next;
  }
  return current;
}

function filterClose(points: Point[], minDist: number): Point[] {
  if (points.length === 0) return [];
  const result = [points[0]];
  for (let i = 1; i < points.length; i++) {
    if (distance(result[result.length - 1], points[i]) >= minDist) {
      result.push(points[i]);
    }
  }
  if (distance(result[result.length - 1], points[points.length - 1]) > 0.01) {
    result.push(points[points.length - 1]);
  }
  return result;
}

function densify(points: Point[]): Point[] {
  if (points.length >= 8) return points;
  const total = pathLength(points);
  if (total < 2) return points;
  return resample(points, 32);
}

function convexHull(points: Point[]): Point[] {
  const pts = uniquePoints(
    [...points].sort((a, b) => a.x - b.x || a.y - b.y)
  );
  if (pts.length <= 2) return pts;

  const cross = (o: Point, a: Point, b: Point) =>
    (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);

  const lower: Point[] = [];
  for (const p of pts) {
    while (
      lower.length >= 2 &&
      cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0
    ) {
      lower.pop();
    }
    lower.push(p);
  }

  const upper: Point[] = [];
  for (let i = pts.length - 1; i >= 0; i--) {
    const p = pts[i];
    while (
      upper.length >= 2 &&
      cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0
    ) {
      upper.pop();
    }
    upper.push(p);
  }

  lower.pop();
  upper.pop();
  return lower.concat(upper);
}

function uniquePoints(points: Point[]): Point[] {
  const result: Point[] = [];
  for (const p of points) {
    const last = result[result.length - 1];
    if (!last || distance(last, p) > 0.4) result.push(p);
  }
  return result;
}

function boundingBox(points: Point[]): Bounds {
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const p of points) {
    minX = Math.min(minX, p.x);
    maxX = Math.max(maxX, p.x);
    minY = Math.min(minY, p.y);
    maxY = Math.max(maxY, p.y);
  }
  return { minX, maxX, minY, maxY };
}

function centroid(points: Point[]): Point {
  let x = 0;
  let y = 0;
  for (const p of points) {
    x += p.x;
    y += p.y;
  }
  return { x: x / points.length, y: y / points.length };
}

function polygonArea(points: Point[]): number {
  let area = 0;
  for (let i = 0; i < points.length; i++) {
    const j = (i + 1) % points.length;
    area += points[i].x * points[j].y - points[j].x * points[i].y;
  }
  return area / 2;
}

export function pathLength(points: Point[]): number {
  let total = 0;
  for (let i = 1; i < points.length; i++) {
    total += distance(points[i - 1], points[i]);
  }
  return total;
}

export function distance(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function perpendicularDistance(point: Point, a: Point, b: Point): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  if (dx === 0 && dy === 0) return distance(point, a);
  return (
    Math.abs(dy * point.x - dx * point.y + b.x * a.y - b.y * a.x) /
    Math.hypot(dx, dy)
  );
}

function turningAngle(a: Point, b: Point, c: Point): number {
  const ab = sub(a, b);
  const cb = sub(c, b);
  const mag = Math.hypot(ab.x, ab.y) * Math.hypot(cb.x, cb.y);
  if (mag === 0) return 180;
  const cosine = clamp((ab.x * cb.x + ab.y * cb.y) / mag, -1, 1);
  return (Math.acos(cosine) * 180) / Math.PI;
}

function headingChange(a: Point, b: Point, c: Point): number {
  const incoming = Math.atan2(b.y - a.y, b.x - a.x);
  const outgoing = Math.atan2(c.y - b.y, c.x - b.x);
  let delta = outgoing - incoming;
  while (delta > Math.PI) delta -= Math.PI * 2;
  while (delta < -Math.PI) delta += Math.PI * 2;
  return (Math.abs(delta) * 180) / Math.PI;
}

function sub(a: Point, b: Point): Point {
  return { x: a.x - b.x, y: a.y - b.y };
}

function dot(a: Point, b: Point): number {
  return a.x * b.x + a.y * b.y;
}

function normalize(p: Point): Point {
  const len = Math.hypot(p.x, p.y);
  if (len < 1e-8) return { x: 0, y: 0 };
  return { x: p.x / len, y: p.y / len };
}

function average(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function stddev(values: number[]): number {
  if (values.length === 0) return 0;
  const mean = average(values);
  const v =
    values.reduce((sum, x) => sum + (x - mean) ** 2, 0) / values.length;
  return Math.sqrt(v);
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function arrowWings(
  start: Point,
  tip: Point
): { left: Point; right: Point } {
  const angle = Math.atan2(tip.y - start.y, tip.x - start.x);
  const len = Math.max(16, Math.min(38, distance(start, tip) * 0.22));
  return {
    left: {
      x: tip.x - len * Math.cos(angle - Math.PI / 6),
      y: tip.y - len * Math.sin(angle - Math.PI / 6),
    },
    right: {
      x: tip.x - len * Math.cos(angle + Math.PI / 6),
      y: tip.y - len * Math.sin(angle + Math.PI / 6),
    },
  };
}

export function sampleShapeOutline(
  shape: RecognitionResult,
  count = 64
): Point[] {
  if (shape.type === "circle" && shape.center && shape.radiusX && shape.radiusY) {
    const pts: Point[] = [];
    const rot = shape.rotation ?? 0;
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2;
      const x = shape.radiusX * Math.cos(a);
      const y = shape.radiusY * Math.sin(a);
      pts.push({
        x: shape.center.x + x * Math.cos(rot) - y * Math.sin(rot),
        y: shape.center.y + x * Math.sin(rot) + y * Math.cos(rot),
      });
    }
    return pts;
  }

  if (shape.type === "rectangle" || shape.type === "triangle") {
    return samplePolygon(shape.points, count, true);
  }

  if (shape.type === "line") {
    return resample(shape.points, count);
  }

  if (shape.type === "arrow" && shape.points.length >= 2) {
    const start = shape.points[0];
    const tip = shape.points[1];
    const wings = arrowWings(start, tip);
    return samplePolygon([start, tip, wings.left, tip, wings.right], count, false);
  }

  return shape.points;
}

export function lerpPath(
  source: Point[],
  target: Point[],
  t: number,
  closed: boolean
): Point[] {
  const n = 64;
  const src = resample(source, n);
  let dst = resample(target, n);
  if (closed) dst = alignClosed(src, dst);
  const k = clamp(t, 0, 1);
  return src.map((p, i) => ({
    x: p.x + (dst[i].x - p.x) * k,
    y: p.y + (dst[i].y - p.y) * k,
  }));
}

function samplePolygon(
  vertices: Point[],
  count: number,
  closed: boolean
): Point[] {
  if (vertices.length < 2) return vertices;
  const loop = closed ? [...vertices, vertices[0]] : vertices;
  return resample(loop, count);
}

function alignClosed(source: Point[], target: Point[]): Point[] {
  const n = source.length;
  if (n === 0 || n !== target.length) return target;

  const score = (dst: Point[], offset: number) => {
    let total = 0;
    for (let i = 0; i < n; i++) {
      const p = source[i];
      const q = dst[(i + offset) % n];
      total += (p.x - q.x) ** 2 + (p.y - q.y) ** 2;
    }
    return total;
  };

  const reversed = [...target].reverse();
  let best = target;
  let bestScore = Infinity;

  for (const candidate of [target, reversed]) {
    for (let off = 0; off < n; off += 2) {
      const s = score(candidate, off);
      if (s < bestScore) {
        bestScore = s;
        best = candidate.map((_, i) => candidate[(i + off) % n]);
      }
    }
  }

  return best;
}
