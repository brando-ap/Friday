import React, { useState } from 'react';

// Capture in ~10 seconds: title is enough, the rest is optional and editable later.
export default function QuickAdd({ onCreate }) {
  const [title, setTitle] = useState('');
  const [requester, setRequester] = useState('');
  const [due, setDue] = useState('');

  const submit = (e) => {
    e.preventDefault();
    if (!title.trim()) return;
    onCreate({
      title: title.trim(),
      requester: requester.trim() || null,
      due_date: due || null,
    });
    setTitle('');
    setRequester('');
    setDue('');
  };

  return (
    <form className="quick-add" onSubmit={submit}>
      <input
        className="qa-title"
        placeholder="Quick add a task — type it and hit Enter"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        autoFocus
      />
      <input
        className="qa-req"
        placeholder="Requester"
        value={requester}
        onChange={(e) => setRequester(e.target.value)}
      />
      <input
        className="qa-due"
        type="date"
        value={due}
        onChange={(e) => setDue(e.target.value)}
      />
      <button type="submit">Add</button>
    </form>
  );
}
