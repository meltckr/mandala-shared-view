import {validate} from './state.mjs';

export const REFLECTION_FIELDS = Object.freeze([
  Object.freeze({field:'emotions', title:'Feelings', category:'Feeling', shape:'orb', angle:-1.1}),
  Object.freeze({field:'thoughts', title:'Thoughts', category:'Idea', shape:'crystal', angle:.35}),
  Object.freeze({field:'intention', title:'Intention', category:'Object', shape:'stone', angle:1.05})
]);

function validDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return year >= 1 && month >= 1 && month <= 12 && day >= 1 && day <= days[month - 1];
}

export function reflectionId(date, field) {
  if (!validDate(date) || !REFLECTION_FIELDS.some(value => value.field === field)) {
    throw new Error('Choose a valid check-in date and reflection field.');
  }
  return `reflection:${date}:${field}`;
}

export function reflectionSource(id) {
  if (typeof id !== 'string') return null;
  const match = /^reflection:(\d{4}-\d{2}-\d{2}):(emotions|thoughts|intention)$/.exec(id);
  return match && validDate(match[1]) ? {date:match[1], field:match[2]} : null;
}

export function applyReflectionChoices(state, entry, choices) {
  validate(state);
  if (!entry || !validDate(entry.date)) throw new Error('Choose a saved check-in date.');
  if (!choices || typeof choices !== 'object' || Array.isArray(choices) ||
      Object.keys(choices).length !== REFLECTION_FIELDS.length ||
      !REFLECTION_FIELDS.every(({field}) => Object.hasOwn(choices, field))) {
    throw new Error('Choose visibility for feelings, thoughts and intention.');
  }
  // Validate every choice before constructing any changes.
  for (const {field} of REFLECTION_FIELDS) {
    const choice = choices[field];
    if (!choice || typeof choice.visible !== 'boolean') throw new Error('Reflection visibility must be true or false.');
    if (choice.visible) {
      if (typeof entry[field] !== 'string' || !entry[field].trim()) throw new Error('Save this reflection before showing it in your mandala.');
      if (typeof choice.label !== 'string' || !choice.label.trim() || choice.label.length > 80) throw new Error('Give each visible reflection a label of 1–80 characters.');
    }
  }
  const next = structuredClone(state);
  for (const {field, title, category, angle} of REFLECTION_FIELDS) {
    const id = reflectionId(entry.date, field);
    const index = next.items.findIndex(item => item.id === id);
    const choice = choices[field];
    if (!choice.visible) {
      if (index !== -1) next.items.splice(index, 1);
      continue;
    }
    const existing = index === -1 ? null : next.items[index];
    const item = {
      id, category, name:choice.label.trim(),
      note:`${title} from your check-in on ${entry.date}.`,
      angle:existing?.angle ?? angle, radius:existing?.radius ?? 3.2, scale:existing?.scale ?? 1
    };
    if (index === -1) next.items.push(item);
    else next.items[index] = item;
  }
  if (next.items.length > 80) throw new Error('Your mandala can hold up to 80 items. Remove an item before showing another reflection.');
  validate(next);
  return next;
}
