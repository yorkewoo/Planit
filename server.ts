import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize Supabase Client
const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY || '';

if (!supabaseUrl || !supabaseKey) {
  console.warn('WARNING: Missing Supabase credentials in .env file.');
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API Routes
  app.get('/api/data', async (req, res) => {
    try {
      const [staffRes, projectsRes, tasksRes] = await Promise.all([
        supabase.from('staff').select('*'),
        supabase.from('projects').select('*'),
        supabase.from('tasks').select('*'),
      ]);

      if (staffRes.error) throw staffRes.error;
      if (projectsRes.error) throw projectsRes.error;
      if (tasksRes.error) throw tasksRes.error;

      res.json({
        staff: staffRes.data,
        projects: projectsRes.data,
        tasks: tasksRes.data,
      });
    } catch (error) {
      console.error('Error fetching data from Supabase:', error);
      res.status(500).json({ error: 'Failed to fetch data' });
    }
  });

  app.post('/api/projects', async (req, res) => {
    try {
      const { data, error } = await supabase.from('projects').insert([req.body]).select().single();
      if (error) throw error;
      res.json({ success: true, project: data });
    } catch (error) {
      console.error('Error inserting project:', error);
      res.status(500).json({ error: 'Failed to save project' });
    }
  });

  app.post('/api/staff', async (req, res) => {
    try {
      const { data, error } = await supabase.from('staff').insert([req.body]).select().single();
      if (error) throw error;
      res.json({ success: true, staff: data });
    } catch (error) {
      console.error('Error inserting staff:', error);
      res.status(500).json({ error: 'Failed to save staff' });
    }
  });

  app.post('/api/tasks', async (req, res) => {
    try {
      const { data, error } = await supabase.from('tasks').insert([req.body]).select().single();
      if (error) throw error;
      res.json({ success: true, task: data });
    } catch (error) {
      console.error('Error inserting task:', error);
      res.status(500).json({ error: 'Failed to save task' });
    }
  });

  app.delete('/api/staff/:id', async (req, res) => {
    try {
      const { error } = await supabase.from('staff').delete().eq('id', req.params.id);
      if (error) throw error;
      res.json({ success: true });
    } catch (error) {
      console.error('Error deleting staff:', error);
      res.status(500).json({ error: 'Failed to delete staff' });
    }
  });

  app.delete('/api/tasks/:id', async (req, res) => {
    try {
      const { error } = await supabase.from('tasks').delete().eq('id', req.params.id);
      if (error) throw error;
      res.json({ success: true });
    } catch (error) {
      console.error('Error deleting task:', error);
      res.status(500).json({ error: 'Failed to delete task' });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, 'dist')));
    app.get('*', (req, res) => {
      res.sendFile(path.join(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
