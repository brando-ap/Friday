import React, { useEffect, useState } from 'react';
import { api } from '../api.js';

const STATUSES = [
  ['not_started', 'Not started'],
  ['in_progress', 'In progress'],
  ['waiting', 'Waiting'],
  ['done', 'Done'],
];
const LOCATIONS = ['', 'warehouse', 'main', 'other'];

export default function TaskDetail({ taskId, onChanged, onClose }) {
  const [task, setTask] = useState(null);
  const [note, setNote] = useState('');
  const [step, setStep] = useState('');

  useEffect(() => {
    if (taskId == null) {
      setTask(null);
      return;
    }
    api.getTask(taskId).then(setTask).catch(() => setTask(null));
  }, [taskId]);

  if (taskId == null) {
    return <div className="detail empty">Select a task to see details, steps, and its activity log.</div>;
  }
  if (!task) return <div className="detail">Loading…</div>;

  // Local edit then persist on blur — keeps typing snappy, saves when you move on.
  const edit = (field, value) => setTask({ ...task, [field]: value });
  const patch = async (data) => {
    setTask(await api.updateTask(task.id, data));
    onChanged();
  };
  const patchField = (field) => patch({ [field]: task[field] ?? '' });

  const submitNote = async (e) => {
    e.preventDefault();
    if (!note.trim()) return;
    setTask(await api.addNote(task.id, note.trim()));
    setNote('');
    onChanged();
  };

  const submitStep = async (e) => {
    e.preventDefault();
    if (!step.trim()) return;
    setTask(await api.addSubtask(task.id, step.trim()));
    setStep('');
    onChanged();
  };

  const toggleStep = async (s) => {
    setTask(await api.setSubtaskDone(s.id, !s.done));
    onChanged();
  };

  const removeStep = async (s) => {
    setTask(await api.deleteSubtask(s.id));
    onChanged();
  };

  const remove = async () => {
    if (!window.confirm('Delete this task for good?')) return;
    await api.deleteTask(task.id);
    onChanged();
    onClose();
  };

  const doneSteps = task.subtasks.filter((s) => s.done).length;

  return (
    <div className="detail">
      <div className="detail-head">
        <input
          className="detail-title"
          value={task.title}
          onChange={(e) => edit('title', e.target.value)}
          onBlur={() => patchField('title')}
        />
        <button className="link" title="Close" onClick={onClose}>✕</button>
      </div>

      <div className="field-grid">
        <label>
          Status
          <select value={task.status} onChange={(e) => patch({ status: e.target.value })}>
            {STATUSES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </label>
        <label>
          Due date
          <input
            type="date"
            value={task.due_date || ''}
            onChange={(e) => patch({ due_date: e.target.value })}
          />
        </label>
        <label>
          Requester
          <input
            value={task.requester || ''}
            onChange={(e) => edit('requester', e.target.value)}
            onBlur={() => patchField('requester')}
          />
        </label>
        <label>
          For
          <input
            value={task.requested_for || ''}
            onChange={(e) => edit('requested_for', e.target.value)}
            onBlur={() => patchField('requested_for')}
          />
        </label>
        <label>
          Location
          <select value={task.location || ''} onChange={(e) => patch({ location: e.target.value })}>
            {LOCATIONS.map((v) => <option key={v} value={v}>{v || '—'}</option>)}
          </select>
        </label>
      </div>

      {task.status === 'waiting' && (
        <div className="waiting-box">
          <label>
            Waiting on
            <input
              value={task.waiting_on || ''}
              placeholder="who / what"
              onChange={(e) => edit('waiting_on', e.target.value)}
              onBlur={() => patchField('waiting_on')}
            />
          </label>
          {task.waiting_since && <span className="waiting-since">since {task.waiting_since}</span>}
        </div>
      )}

      <label className="block-label">
        Description
        <textarea
          rows={3}
          value={task.description || ''}
          onChange={(e) => edit('description', e.target.value)}
          onBlur={() => patchField('description')}
        />
      </label>

      <section className="steps">
        <h3>
          Steps {task.subtasks.length > 0 && <span className="count">{doneSteps}/{task.subtasks.length}</span>}
        </h3>
        <ul>
          {task.subtasks.map((s) => (
            <li key={s.id}>
              <label className={s.done ? 'done' : ''}>
                <input type="checkbox" checked={!!s.done} onChange={() => toggleStep(s)} />
                {s.title}
              </label>
              <button className="link" onClick={() => removeStep(s)}>✕</button>
            </li>
          ))}
        </ul>
        <form onSubmit={submitStep}>
          <input value={step} onChange={(e) => setStep(e.target.value)} placeholder="Add a step…" />
        </form>
      </section>

      <section className="activity">
        <h3>Activity log</h3>
        <form onSubmit={submitNote}>
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="What did you just do? (timestamped)"
          />
        </form>
        <ul>
          {task.activity.map((a) => (
            <li key={a.id}>
              <span className="a-time">{new Date(a.created_at).toLocaleString()}</span>
              <span className="a-note">{a.note}</span>
            </li>
          ))}
        </ul>
      </section>

      <button className="delete" onClick={remove}>Delete task</button>
    </div>
  );
}
