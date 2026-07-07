import React from 'react';

const STATUS_OPTIONS = [
  ['', 'All statuses'],
  ['not_started', 'Not started'],
  ['in_progress', 'In progress'],
  ['waiting', 'Waiting'],
  ['done', 'Done'],
];
const SORT_OPTIONS = [
  ['due', 'By due date'],
  ['urgency', 'By urgency'],
];

export const FILTER_DEFAULTS = {
  q: '', status: '', client: '', requester: '', assignee: '', sort: 'due',
};

export default function FilterBar({ filters, onChange, clients, requesters, members, onExport, onImport }) {
  const set = (key, value) => onChange({ ...filters, [key]: value });
  const active = Object.keys(FILTER_DEFAULTS).some((k) => filters[k] !== FILTER_DEFAULTS[k]);

  return (
    <div className="filter-bar">
      <input
        className="fb-search"
        placeholder="Search title or notes…"
        value={filters.q}
        onChange={(e) => set('q', e.target.value)}
      />
      <select value={filters.status} onChange={(e) => set('status', e.target.value)}>
        {STATUS_OPTIONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
      <select value={filters.client} onChange={(e) => set('client', e.target.value)}>
        <option value="">All companies</option>
        {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
      </select>
      <select value={filters.requester} onChange={(e) => set('requester', e.target.value)}>
        <option value="">All requesters</option>
        {requesters.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
      </select>
      <select value={filters.assignee} onChange={(e) => set('assignee', e.target.value)}>
        <option value="">Anyone</option>
        {members.map((m) => <option key={m.user_id} value={m.user_id}>{m.full_name || m.email}</option>)}
      </select>
      <select value={filters.sort} onChange={(e) => set('sort', e.target.value)}>
        {SORT_OPTIONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
      {active && (
        <button type="button" className="link" onClick={() => onChange({ ...FILTER_DEFAULTS })}>
          Clear
        </button>
      )}
      <span className="fb-spacer" />
      <button type="button" className="fb-csv" onClick={onExport} title="Download the list below as CSV">
        Export CSV
      </button>
      <button type="button" className="fb-csv" onClick={onImport} title="Bulk-import tasks from CSV">
        Import
      </button>
    </div>
  );
}
