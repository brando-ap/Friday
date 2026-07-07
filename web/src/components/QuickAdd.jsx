import React, { useState } from 'react';
import RequesterPicker, { ClientPicker } from './RequesterPicker.jsx';

const EMPTY_SEL = { requester_id: null, client_id: null, requester: null };
const RECURRENCE_OPTIONS = [
  ['', 'No repeat'],
  ['daily', 'Daily'],
  ['weekly', 'Weekly'],
  ['monthly', 'Monthly'],
];

// Capture in ~10 seconds: title is enough, the rest is optional and editable later.
export default function QuickAdd({ onCreate, requesters, clients, titleRef }) {
  const [title, setTitle] = useState('');
  const [sel, setSel] = useState(EMPTY_SEL);
  const [due, setDue] = useState('');
  const [recurrence, setRecurrence] = useState('');

  const pickedRequester = requesters.find((r) => r.id === sel.requester_id) || null;

  const submit = (e) => {
    e.preventDefault();
    if (!title.trim()) return;
    onCreate({
      title: title.trim(),
      requester: sel.requester,
      requester_id: sel.requester_id,
      client_id: sel.client_id,
      due_date: due || null,
      recurrence: recurrence || null,
    });
    setTitle('');
    setSel(EMPTY_SEL);
    setDue('');
    setRecurrence('');
  };

  return (
    <form className="quick-add" onSubmit={submit}>
      <input
        ref={titleRef}
        className="qa-title"
        placeholder="Quick add a task — type it and hit Enter"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        autoFocus
      />
      <div className="qa-req">
        <RequesterPicker requesters={requesters} selection={sel} onSelect={setSel} />
      </div>
      {pickedRequester && pickedRequester.client_ids.length > 1 && (
        <ClientPicker
          clients={clients}
          requester={pickedRequester}
          value={sel.client_id}
          onChange={(client_id) => setSel({ ...sel, client_id })}
        />
      )}
      <input
        className="qa-due"
        type="date"
        value={due}
        onChange={(e) => setDue(e.target.value)}
      />
      <select
        className="qa-rec"
        value={recurrence}
        onChange={(e) => setRecurrence(e.target.value)}
        title="Repeat"
      >
        {RECURRENCE_OPTIONS.map(([v, l]) => (
          <option key={v} value={v}>{l}</option>
        ))}
      </select>
      <button type="submit">Add</button>
    </form>
  );
}
