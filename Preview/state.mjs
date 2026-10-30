export const KEY = 'living-mandala-study-v1';
export const CATEGORIES = ['Person', 'Pet', 'Object', 'Idea', 'Feeling'];
export const clone = value => JSON.parse(JSON.stringify(value));
export function seed(id = () => crypto.randomUUID()) {
  return {format: 'living-mandala-study', version: 1, environment: 'golden', reducedMotion: false,
    items: CATEGORIES.map((category, i) => ({id: id(), category,
      name: ['Someone important', 'A companion', 'Something treasured', 'An idea to explore', 'How I feel'][i],
      note: 'A sample. Make this your own.', angle: (i - 2) * 0.48, radius: 7.2, scale: 1}))};
}
export function benjiItem(id = crypto.randomUUID(), angle = 0) {
  return {id, category: 'Pet', appearance: 'benji-study', name: 'Benji',
    note: 'My three-year-old tricolor Bernedoodle. Provisional companion study; likeness awaits reference photos.',
    angle, radius: 4.5, scale: 1};
}
export function validate(value) {
  if (!value || value.format !== 'living-mandala-study' || value.version !== 1 ||
      !['golden', 'daylight', 'blue'].includes(value.environment) || typeof value.reducedMotion !== 'boolean' ||
      !Array.isArray(value.items) || value.items.length > 80) throw new Error('This file is not a supported mandala study.');
  const ids = new Set();
  for (const item of value.items) {
    if (!item || typeof item.id !== 'string' || item.id.length > 80 || !item.id.length || ids.has(item.id) ||
        !CATEGORIES.includes(item.category) ||
        (item.appearance !== undefined && !((item.appearance === 'benji-study' && item.category === 'Pet') || (item.appearance === 'mercedes-study' && item.category === 'Person'))) || typeof item.name !== 'string' || !item.name.trim() || item.name.length > 80 ||
        typeof item.note !== 'string' || item.note.length > 2000 || !Number.isFinite(item.angle) || Math.abs(item.angle) > Math.PI * 2 ||
        !Number.isFinite(item.radius) || item.radius < 2 || item.radius > 15 ||
        !Number.isFinite(item.scale) || item.scale < 0.5 || item.scale > 2) throw new Error('An item contains an invalid value.');
    ids.add(item.id);
  }
  return clone(value);
}
export class WorldStore {
  constructor(storage, initial = seed()) {
    this.storage = storage; this.state = validate(initial); this.history = []; this.blocked = false;
    this.status = 'Sample world'; this.original = null;
    try {
      const raw = storage.getItem(KEY);
      if (raw !== null) { this.original = raw; this.state = validate(JSON.parse(raw)); this.status = 'Saved on this browser'; }
    } catch (error) { this.blocked = true; this.status = 'Saved world needs recovery · original preserved'; }
  }
  commit(change) {
    if (this.blocked) return false;
    const next = clone(this.state); change(next);
    const checked = validate(next);
    this.history.push(clone(this.state)); if (this.history.length > 30) this.history.shift();
    this.state = checked; return this.save();
  }
  save() {
    if (this.blocked) return false;
    try {
      const raw = JSON.stringify(validate(this.state));
      const previous = this.storage.getItem(KEY);
      if (previous !== null) this.storage.setItem(KEY + '-previous', previous);
      this.storage.setItem(KEY, raw); this.status = 'Saved on this browser'; return true;
    } catch (error) { this.status = 'Changes unsaved · export a copy'; return false; }
  }
  undo() {
    if (this.blocked || !this.history.length) return false;
    this.state = this.history.pop(); return this.save();
  }
  import(raw) {
    const next = validate(JSON.parse(raw));
    return this.commit(state => Object.assign(state, next));
  }
}
