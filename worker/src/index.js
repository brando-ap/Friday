import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { getDb } from './supabase.js';
import * as repo from './repo.js';

const app = new Hono();

// Allow the frontend origin to call the API (needed once the Pages site and the
// Worker live on different origins; harmless in local dev behind the Vite proxy).
app.use('/api/*', cors());

app.get('/api/health', (c) => c.json({ ok: true }));

app.get('/api/tasks', async (c) => {
  return c.json(await repo.listTasks(getDb(c.env)));
});

app.post('/api/tasks', async (c) => {
  const body = await c.req.json().catch(() => ({}));
  if (!(body.title || '').trim()) return c.json({ error: 'title is required' }, 400);
  return c.json(await repo.createTask(getDb(c.env), body), 201);
});

app.get('/api/tasks/:id', async (c) => {
  const task = await repo.getTask(getDb(c.env), Number(c.req.param('id')));
  return task ? c.json(task) : c.json({ error: 'not found' }, 404);
});

app.patch('/api/tasks/:id', async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const task = await repo.updateTask(getDb(c.env), Number(c.req.param('id')), body);
  return task ? c.json(task) : c.json({ error: 'not found' }, 404);
});

app.delete('/api/tasks/:id', async (c) => {
  const ok = await repo.deleteTask(getDb(c.env), Number(c.req.param('id')));
  return ok ? c.body(null, 204) : c.json({ error: 'not found' }, 404);
});

app.post('/api/tasks/:id/notes', async (c) => {
  const body = await c.req.json().catch(() => ({}));
  if (!(body.note || '').trim()) return c.json({ error: 'note is required' }, 400);
  const task = await repo.addNote(getDb(c.env), Number(c.req.param('id')), body.note.trim());
  return task ? c.json(task, 201) : c.json({ error: 'not found' }, 404);
});

app.post('/api/tasks/:id/subtasks', async (c) => {
  const body = await c.req.json().catch(() => ({}));
  if (!(body.title || '').trim()) return c.json({ error: 'title is required' }, 400);
  const task = await repo.addSubtask(getDb(c.env), Number(c.req.param('id')), body.title.trim());
  return task ? c.json(task, 201) : c.json({ error: 'not found' }, 404);
});

app.patch('/api/subtasks/:id', async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const task = await repo.setSubtaskDone(getDb(c.env), Number(c.req.param('id')), !!body.done);
  return task ? c.json(task) : c.json({ error: 'not found' }, 404);
});

app.delete('/api/subtasks/:id', async (c) => {
  const task = await repo.deleteSubtask(getDb(c.env), Number(c.req.param('id')));
  return task ? c.json(task) : c.json({ error: 'not found' }, 404);
});

app.onError((err, c) => {
  console.error(err);
  return c.json({ error: err.message || 'internal error' }, 500);
});

export default app;
