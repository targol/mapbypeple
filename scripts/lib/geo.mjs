// Small geometry helpers shared by the import scripts (plain ESM, no dependencies).

export const toRad = (d) => (d * Math.PI) / 180;

export function haversineMeters(a, b) {
  const R = 6371008.8;
  const dLat = toRad(b[0] - a[0]);
  const dLng = toRad(b[1] - a[1]);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a[0])) * Math.cos(toRad(b[0])) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

export function polylineLengthMeters(points) {
  let total = 0;
  for (let i = 1; i < points.length; i++) total += haversineMeters(points[i - 1], points[i]);
  return total;
}

/**
 * Distance from `point` to a polyline plus the distance travelled along the line to the
 * closest spot. Uses a local flat projection, which is accurate to well under a metre at
 * village scale. Points and line are [lat, lng].
 */
export function nearestOnPolyline(point, line) {
  const lat0 = point[0];
  const kx = 111320 * Math.cos(toRad(lat0));
  const ky = 110540;
  const proj = (p) => [(p[1] - point[1]) * kx, (p[0] - point[0]) * ky];
  let best = { distance: Infinity, along: 0 };
  let travelled = 0;
  for (let i = 1; i < line.length; i++) {
    const [ax, ay] = proj(line[i - 1]);
    const [bx, by] = proj(line[i]);
    const dx = bx - ax;
    const dy = by - ay;
    const len2 = dx * dx + dy * dy;
    const segLen = Math.sqrt(len2);
    let t = len2 === 0 ? 0 : -(ax * dx + ay * dy) / len2;
    t = Math.max(0, Math.min(1, t));
    const px = ax + t * dx;
    const py = ay + t * dy;
    const distance = Math.hypot(px, py);
    if (distance < best.distance) best = { distance, along: travelled + t * segLen };
    travelled += segLen;
  }
  return best;
}

export function centroid(points) {
  const ring =
    points.length > 1 &&
    points[0][0] === points[points.length - 1][0] &&
    points[0][1] === points[points.length - 1][1]
      ? points.slice(0, -1)
      : points;
  const sum = ring.reduce((acc, p) => [acc[0] + p[0], acc[1] + p[1]], [0, 0]);
  return [sum[0] / ring.length, sum[1] / ring.length];
}
