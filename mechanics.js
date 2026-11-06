export const damp = (value, goal, rate, dt) => goal + (value - goal) * Math.exp(-rate * dt);
export const dampAngle = (value, goal, rate, dt) => value + Math.atan2(Math.sin(goal - value), Math.cos(goal - value)) * (1 - Math.exp(-rate * dt));

export function radialStick(x, y) {
  const length = Math.hypot(x, y);
  if (length <= .12) return { x: 0, y: 0 };
  const strength = Math.min(1, (length - .12) / .88);
  return { x: x / length * strength, y: y / length * strength };
}

export const throwPower = seconds => 3.3 + Math.min(.85, Math.max(0, seconds)) / .85 * 5.2;

// Segment vs. expanded furniture footprints. Keeping a margin prevents corner cutting.
export function segmentClear(a, b, blocks, margin = .34) {
  for (const block of blocks) {
    let near = 0, far = 1, misses = false;
    for (const [axis, center, half] of [[0, block.x, block.w], [1, block.z, block.d]]) {
      const delta = b[axis] - a[axis], min = center - half - margin, max = center + half + margin;
      if (Math.abs(delta) < 1e-9) { if (a[axis] <= min || a[axis] >= max) { misses = true; break; } }
      else {
        let enter = (min - a[axis]) / delta, leave = (max - a[axis]) / delta;
        if (enter > leave) [enter, leave] = [leave, enter];
        near = Math.max(near, enter); far = Math.min(far, leave);
        if (near >= far) { misses = true; break; }
      }
    }
    if (!misses && near < far) return false;
  }
  return true;
}

export function findPath(start, goal, blocks) {
  if (segmentClear(start, goal, blocks)) return [start, goal];
  const step = .4, cols = 38, rows = 28, count = cols * rows;
  const point = id => [-7.4 + id % cols * step, -5.4 + Math.floor(id / cols) * step];
  const free = new Uint8Array(count);
  for (let id = 0; id < count; id++) { const p = point(id); free[id] = !blocks.some(b => Math.abs(p[0] - b.x) < b.w + .34 && Math.abs(p[1] - b.z) < b.d + .34); }
  const nearest = p => {
    let best = -1, distance = Infinity;
    for (let id = 0; id < count; id++) if (free[id]) {
      const q = point(id), d = (q[0] - p[0]) ** 2 + (q[1] - p[1]) ** 2;
      if (d < distance) { distance = d; best = id; }
    }
    return best;
  };
  const from = nearest(start), to = nearest(goal);
  if (from < 0 || to < 0) return [];
  const cost = new Float64Array(count).fill(Infinity), estimate = new Float64Array(count).fill(Infinity);
  const parent = new Int32Array(count).fill(-1), closed = new Uint8Array(count), open = new Set([from]);
  const destination = point(to), heuristic = id => { const p = point(id); return Math.hypot(p[0] - destination[0], p[1] - destination[1]); };
  cost[from] = 0; estimate[from] = heuristic(from);
  while (open.size) {
    let current = -1;
    for (const id of open) if (current < 0 || estimate[id] < estimate[current]) current = id;
    if (current === to) {
      const path = [];
      for (let id = to; id !== -1; id = parent[id]) path.unshift(point(id));
      if (segmentClear(start, path[0], blocks)) path.unshift(start);
      if (segmentClear(path.at(-1), goal, blocks)) path.push(goal);
      const smooth = [path[0]];
      for (let i = 0; i < path.length - 1;) {
        let next = path.length - 1;
        while (next > i + 1 && !segmentClear(path[i], path[next], blocks)) next--;
        smooth.push(path[next]); i = next;
      }
      return smooth;
    }
    open.delete(current); closed[current] = 1;
    const x = current % cols, z = Math.floor(current / cols);
    for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
      if (!dx && !dz || x + dx < 0 || x + dx >= cols || z + dz < 0 || z + dz >= rows) continue;
      const next = current + dz * cols + dx;
      if (!free[next] || closed[next] || !segmentClear(point(current), point(next), blocks)) continue;
      const distance = cost[current] + Math.hypot(dx, dz) * step;
      if (distance >= cost[next]) continue;
      parent[next] = current; cost[next] = distance; estimate[next] = distance + heuristic(next); open.add(next);
    }
  }
  return [];
}
