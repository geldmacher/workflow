export function linearChain(items, predecessorField, label, failures) {
  if (items.length === 0) return [];
  const byId = new Map(items.map((item) => [item.fields.id, item]));
  const starts = items.filter((item) => !item.fields[predecessorField]);
  if (starts.length !== 1) failures.push(`${label}: chain requires exactly one initial artifact`);
  const successors = new Map();
  for (const item of items) {
    const predecessor = item.fields[predecessorField];
    if (!predecessor) continue;
    if (!byId.has(predecessor)) failures.push(`${item.label}: missing predecessor ${predecessor}`);
    const list = successors.get(predecessor) ?? [];
    list.push(item);
    successors.set(predecessor, list);
  }
  for (const [id, list] of successors) if (list.length > 1) failures.push(`${label}: chain branches after ${id}`);
  const ordered = [];
  const seen = new Set();
  let cursor = starts[0];
  while (cursor && !seen.has(cursor.fields.id)) {
    seen.add(cursor.fields.id);
    ordered.push(cursor);
    cursor = successors.get(cursor.fields.id)?.[0];
  }
  if (cursor || ordered.length !== items.length) failures.push(`${label}: chain is cyclic or disconnected`);
  return ordered;
}

export function lineageTips(items, predecessorField) {
  const referenced = new Set(items.map((item) => item.fields[predecessorField]).filter(Boolean));
  return items.filter((item) => !referenced.has(item.fields.id));
}
