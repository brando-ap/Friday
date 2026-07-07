import React from 'react';
import { urgency, dueLabel } from '../dates.js';

const STATUS_LABEL = {
  not_started: 'Not started',
  in_progress: 'In progress',
  waiting: 'Waiting',
  done: 'Done',
};

// "BT" from "Brandon Taylor", or the first letters of an email's local part.
export function memberInitials(member) {
  const src = member?.full_name || member?.email || '';
  const parts = src.replace(/@.*$/, '').split(/[\s._-]+/).filter(Boolean);
  return parts.slice(0, 2).map((p) => p[0].toUpperCase()).join('') || '?';
}

export default function TaskList({ tasks, selectedId, onSelect, members = [] }) {
  if (tasks.length === 0) {
    return <div className="task-list empty">Nothing here yet — add your first task above ↑</div>;
  }

  const memberById = new Map(members.map((m) => [m.user_id, m]));

  return (
    <ul className="task-list">
      {tasks.map((t) => {
        const assignee = t.assignee_id ? memberById.get(t.assignee_id) : null;
        const requesterName = t.requester_ref?.name || t.requester;
        return (
          <li
            key={t.id}
            className={`task-row u-${urgency(t)} ${t.id === selectedId ? 'selected' : ''}`}
            onClick={() => onSelect(t.id)}
          >
            <div className="tr-main">
              <span className="tr-title">
                {t.recurrence && <span className="tr-rec" title={`Repeats ${t.recurrence}`}>↻ </span>}
                {t.title}
              </span>
              <span className="tr-badges">
                {assignee && (
                  <span className="tr-assignee" title={assignee.full_name || assignee.email}>
                    {memberInitials(assignee)}
                  </span>
                )}
                <span className={`tr-status s-${t.status}`}>{STATUS_LABEL[t.status]}</span>
              </span>
            </div>
            <div className="tr-meta">
              <span className="tr-due">{dueLabel(t)}</span>
              {t.client?.name && <span className="tr-client">· {t.client.name}</span>}
              {requesterName && <span>· {requesterName}</span>}
              {t.location && <span className="tr-loc">· {t.location}</span>}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
