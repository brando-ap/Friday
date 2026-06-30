export function todayISO() {
  const d = new Date();
  const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
}

export function daysUntil(dateStr) {
  if (!dateStr) return null;
  const today = new Date(todayISO() + 'T00:00:00');
  const due = new Date(dateStr + 'T00:00:00');
  return Math.round((due - today) / 86400000);
}

// Drives the row color in the list — the whole point of the app.
export function urgency(task) {
  if (task.status === 'done') return 'done';
  const d = daysUntil(task.due_date);
  if (d === null) return 'none';
  if (d < 0) return 'overdue';
  if (d <= 7) return 'soon';
  return 'later';
}

export function dueLabel(task) {
  if (!task.due_date) return 'No date';
  const d = daysUntil(task.due_date);
  if (d === 0) return 'Due today';
  if (d < 0) return `${-d}d overdue`;
  if (d === 1) return 'Due tomorrow';
  if (d <= 7) return `Due in ${d}d`;
  return task.due_date;
}
