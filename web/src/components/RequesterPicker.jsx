import React, { useEffect, useState } from 'react';

// Searchable requester dropdown. Picking a requester auto-fills their company
// when they only have one; free text that matches nobody is kept as the
// unstructured `requester` field (quick-entry fallback).
//
// selection = { requester_id, client_id, requester } — onSelect fires with the
// complete new selection whenever the user commits a change (pick, clear, or
// blur with free text), so parents can setState (QuickAdd) or PATCH (detail).
export default function RequesterPicker({ requesters, selection, onSelect, placeholder }) {
  const selected = requesters.find((r) => r.id === selection.requester_id) || null;
  const [query, setQuery] = useState(selected ? selected.name : selection.requester || '');
  const [open, setOpen] = useState(false);

  // Re-sync the text when the selection changes from outside (e.g. a
  // different task opened in the detail pane, or QuickAdd reset on submit).
  useEffect(() => {
    setQuery(selected ? selected.name : selection.requester || '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selection.requester_id, selection.requester]);

  const q = query.trim().toLowerCase();
  const matches =
    q && (!selected || q !== selected.name.toLowerCase())
      ? requesters.filter((r) => r.name.toLowerCase().includes(q))
      : requesters;

  const pick = (r) => {
    setOpen(false);
    setQuery(r.name);
    onSelect({
      requester_id: r.id,
      client_id: r.client_ids.length === 1 ? r.client_ids[0] : null,
      requester: null,
    });
  };

  const clear = () => {
    setOpen(false);
    setQuery('');
    onSelect({ requester_id: null, client_id: null, requester: null });
  };

  // Blur = commit whatever was typed as free text (options use onMouseDown,
  // which fires first and prevents the blur from double-committing).
  const commitFreeText = () => {
    setOpen(false);
    const text = query.trim();
    if (selected && text === selected.name) return; // unchanged structured pick
    if (!selected && (text || null) === (selection.requester || null)) return; // unchanged text
    onSelect({ requester_id: null, client_id: null, requester: text || null });
  };

  return (
    <div className="rp">
      <input
        value={query}
        placeholder={placeholder || 'Requester'}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={commitFreeText}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && open && matches.length > 0) {
            e.preventDefault();
            pick(matches[0]);
          }
          if (e.key === 'Escape') setOpen(false);
        }}
      />
      {open && (matches.length > 0 || selected || selection.requester) && (
        <ul className="rp-menu">
          {(selected || selection.requester) && (
            <li>
              <button type="button" className="rp-clear" onMouseDown={(e) => { e.preventDefault(); clear(); }}>
                ✕ No requester
              </button>
            </li>
          )}
          {matches.map((r) => (
            <li key={r.id}>
              <button type="button" onMouseDown={(e) => { e.preventDefault(); pick(r); }}>
                {r.name}
                {r.client_ids.length > 0 && (
                  <span className="rp-count">
                    {r.client_ids.length === 1 ? '' : ` · ${r.client_ids.length} companies`}
                  </span>
                )}
              </button>
            </li>
          ))}
          {matches.length === 0 && <li className="rp-none">No match — kept as free text</li>}
        </ul>
      )}
    </div>
  );
}

// Company (client) select that respects the picked requester: limited to the
// requester's companies when one is picked (auto-filled/static when they have
// exactly one), all companies otherwise.
export function ClientPicker({ clients, requester, value, onChange }) {
  const allowed = requester ? clients.filter((c) => requester.client_ids.includes(c.id)) : clients;
  if (requester && allowed.length === 1) {
    return <span className="rp-client">{allowed[0].name}</span>;
  }
  return (
    <select value={value ?? ''} onChange={(e) => onChange(e.target.value ? Number(e.target.value) : null)}>
      <option value="">—</option>
      {allowed.map((c) => (
        <option key={c.id} value={c.id}>{c.name}</option>
      ))}
    </select>
  );
}
