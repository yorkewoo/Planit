-- Disable RLS for all tables to allow public access (Development mode)

ALTER TABLE public.staff DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks DISABLE ROW LEVEL SECURITY;

-- Note: In a production app, you would instead enable RLS and add specific policies.
-- For example, to allow anyone to READ:
-- CREATE POLICY "Allow public read" ON public.staff FOR SELECT USING (true);
-- CREATE POLICY "Allow public read" ON public.projects FOR SELECT USING (true);
-- CREATE POLICY "Allow public read" ON public.tasks FOR SELECT USING (true);
