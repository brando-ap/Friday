import React from 'react';
import { urgency, dueLabel } from '../dates.js';

const STATUS_LABEL = {
  not_started: 'Not started',
  in_progress: 'In progress',
  waiting: 'Waiting',
  done: 'Done',
};

export default function TaskList({ tasks, selectedId, onSelect }) {
  if (tasks.length === 0) {
    return <div className="task-list empty">Nothing here yet — add your first task above ↑</div>;
  }

  return (
    <ul className="task-list">
      {tasks.map((t) => (
        <li
          key={t.id}
          className={`task-row u-${urgency(t)} ${t.id === selectedId ? 'selected' : ''}`}
          onClick={() => onSelect(t.id)}
        >
          <div className="tr-main">
            <span className="tr-title">{t.title}</span>
            <span className={`tr-status s-${t.status}`}>{STATUS_LABEL[t.status]}</span>
          </div>
          <div className="tr-meta">
            <span className="tr-due">{dueLabel(t)}</span>
            {t.requester && <span>· {t.requester}</span>}
            {t.location && <span className="tr-loc">· {t.location}</span>}
          </div>
        </li>
      ))}
    </ul>
  );
}
