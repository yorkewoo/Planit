-- Seed data for Resource Planning App

-- 1. Insert Staff
INSERT INTO public.staff (id, name, role, department, location, initials, "weeklyAllocation", "maxHours") VALUES
('1', 'Ade Kurniadhi', 'Product Lead', 'Product Design', 'Indonesia', 'AK', 32, 40),
('2', 'Anty Satriani', 'Interaction Designer', 'Interactive Media', 'Singapore', 'AS', 38, 40),
('3', 'Atika Apsari', 'Interaction Designer', 'Interactive Media', 'Singapore', 'AA', 10, 40),
('4', 'Billy Gerrardus', 'Interaction Designer', 'Interactive Media', 'Indonesia', 'BG', 40, 40),
('5', 'Chanchan Jiang', 'Project Director', 'Landscape Arch', 'Singapore', 'CJ', 40, 40),
('6', 'Yorke Wu', 'Design Director', 'Product Design', 'Singapore', 'YW', 20, 40),
('7', 'Sarah Chen', 'Senior Architect', 'Architecture', 'Singapore', 'SC', 35, 40);

-- 2. Insert Projects 
INSERT INTO public.projects (id, name, code, client, "ownerId", stage, billable, tags, "startDate", "endDate", "totalAllocation", "teamSize", color) VALUES
('p1', 'Xiamen Red Coral', 'PRJ-001', 'Coastal Dev', '1', 'Confirmed', true, ARRAY['Beach Resort'], '2026-02-01', '2026-05-31', 85, 12, '#ec5b13'),
('p2', 'Blue Bay Masterplan', 'PRJ-002', 'EcoGroup', '2', 'Confirmed', true, ARRAY['Master Planning'], '2026-01-01', '2026-06-15', 60, 8, '#3b82f6'),
('p3', 'Skyline Tower', 'PRJ-003', 'Urban Ltd', '3', 'Tentative', true, ARRAY['High-Rise'], '2026-01-10', '2026-04-30', 45, 25, '#eab308'),
('p4', 'Desert Oasis', 'PRJ-004', 'Nomad Corp', '4', 'Confirmed', true, ARRAY['Blue'], '2026-02-20', '2026-08-12', 100, 5, '#14b8a6'),
('p5', 'Overall DMP', 'PRJ-005', 'Saadiyat', '2', 'Confirmed', true, ARRAY['Masterplan'], '2026-03-01', '2026-06-30', 75, 6, '#8b5cf6');

-- 3. Insert Tasks
INSERT INTO public.tasks (id, "projectId", "staffId", title, "startDate", "endDate", "hoursPerDay", status) VALUES
('t1', 'p1', '1', 'Lap Dinh - S02 Pre...', '2026-03-01', '2026-03-10', 6, 'In Progress'),
('t2', 'p2', '1', 'Stage 2 - DMP', '2026-03-11', '2026-03-14', 8, 'In Progress'),
('t3', 'p5', '2', 'Overall DMP/ or TB 243020-Saadiyat M...', '2026-03-02', '2026-03-08', 8, 'In Progress');
