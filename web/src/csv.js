// Minimal CSV helpers for export/import — no dependency. Handles quoted
// fields, embedded commas/quotes/newlines, and CRLF line endings.

export function toCSV(rows, columns) {
  const esc = (v) => {
    const s = v == null ? '' : String(v);
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [columns.join(','), ...rows.map((r) => columns.map((c) => esc(r[c])).join(','))].join('\r\n');
}

export function parseCSV(text) {
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else inQuotes = false;
      } else field += ch;
    } else if (ch === '"') inQuotes = true;
    else if (ch === ',') {
      row.push(field);
      field = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(field);
      field = '';
      rows.push(row);
      row = [];
    } else field += ch;
  }
  if (field !== '' || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => !(r.length === 1 && r[0].trim() === ''));
}

// Columns the import endpoint accepts. Extra columns in a pasted CSV (e.g. the
// company/assignee columns our own export writes) are simply ignored, so an
// export → import round trip works.
export const IMPORT_COLUMNS = [
  'title', 'description', 'requester', 'requested_for', 'location', 'due_date', 'status',
];

// Header-mapped parse for task import: first row must be headers with at
// least a "title" column. Returns { rows } or { error }.
export function parseTaskCSV(text) {
  const raw = parseCSV(text);
  if (raw.length === 0) return { error: 'nothing to import' };
  const headers = raw[0].map((h) => h.trim().toLowerCase().replace(/\s+/g, '_'));
  if (!headers.includes('title')) {
    return { error: 'first row must be column headers and include "title"' };
  }
  const rows = raw.slice(1).map((r) => {
    const obj = {};
    headers.forEach((h, i) => {
      if (IMPORT_COLUMNS.includes(h)) obj[h] = (r[i] ?? '').trim();
    });
    return obj;
  });
  if (rows.length === 0) return { error: 'no data rows below the header row' };
  return { rows };
}
