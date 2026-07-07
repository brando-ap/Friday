import React, { useMemo, useState } from 'react';
import { api } from '../api.js';
import { parseTaskCSV, IMPORT_COLUMNS } from '../csv.js';

// Bulk import from pasted CSV or a file. Parsing happens here; each row is
// validated server-side and failures come back per row.
export default function ImportDialog({ onClose, onImported }) {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);

  const parsed = useMemo(() => (text.trim() ? parseTaskCSV(text) : null), [text]);

  const readFile = (e) => {
    const file = e.target.files?.[0];
    if (file) file.text().then(setText);
  };

  const submit = async () => {
    if (!parsed || parsed.error) return;
    setBusy(true);
    setError(null);
    try {
      const res = await api.importTasks(parsed.rows);
      setResult(res);
      if (res.created > 0) onImported();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h2>Import tasks from CSV</h2>
          <button className="link" onClick={onClose}>✕</button>
        </div>

        {result ? (
          <div>
            <p className="import-ok">✓ {result.created} task{result.created === 1 ? '' : 's'} imported.</p>
            {result.failed.length > 0 && (
              <>
                <p className="import-fail-head">{result.failed.length} row{result.failed.length === 1 ? '' : 's'} failed:</p>
                <ul className="import-failures">
                  {result.failed.map((f) => (
                    <li key={f.row}>Row {f.row} ({f.title}): {f.error}</li>
                  ))}
                </ul>
              </>
            )}
            <button className="modal-primary" onClick={onClose}>Done</button>
          </div>
        ) : (
          <div>
            <p className="modal-hint">
              First row must be headers. Recognized columns:{' '}
              <code>{IMPORT_COLUMNS.join(', ')}</code> — only <code>title</code> is required.
              Other columns are ignored.
            </p>
            <textarea
              rows={8}
              placeholder={'title,due_date,requester\nCount cycle stock,2026-07-10,Jane'}
              value={text}
              onChange={(e) => setText(e.target.value)}
            />
            <div className="modal-row">
              <input type="file" accept=".csv,text/csv" onChange={readFile} />
            </div>
            {parsed?.error && <div className="error">{parsed.error}</div>}
            {error && <div className="error">{error}</div>}
            <button
              className="modal-primary"
              disabled={busy || !parsed || !!parsed.error}
              onClick={submit}
            >
              {busy ? 'Importing…' : parsed && !parsed.error ? `Import ${parsed.rows.length} row${parsed.rows.length === 1 ? '' : 's'}` : 'Import'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
