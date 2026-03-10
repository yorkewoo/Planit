-- Supabase Schema for Resource Planning App

-- 1. Create Staff table
CREATE TABLE public.staff (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    role TEXT NOT NULL,
    department TEXT NOT NULL,
    location TEXT NOT NULL,
    avatar TEXT,
    weeklyAllocation INTEGER NOT NULL,
    maxHours INTEGER NOT NULL,
    initials TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Create Projects table
CREATE TABLE public.projects (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    code TEXT NOT NULL,
    client TEXT NOT NULL,
    ownerId TEXT NOT NULL,
    stage TEXT NOT NULL CHECK (stage IN ('Confirmed', 'Tentative', 'On Hold')),
    billable BOOLEAN NOT NULL DEFAULT true,
    tags TEXT[] DEFAULT '{}',
    startDate TEXT NOT NULL,
    endDate TEXT NOT NULL,
    notes TEXT,
    totalAllocation INTEGER NOT NULL,
    teamSize INTEGER NOT NULL,
    color TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Create Tasks table
CREATE TABLE public.tasks (
    id TEXT PRIMARY KEY,
    projectId TEXT REFERENCES public.projects(id) ON DELETE CASCADE,
    staffId TEXT REFERENCES public.staff(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    startDate TEXT NOT NULL,
    endDate TEXT NOT NULL,
    hoursPerDay NUMERIC NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('In Progress', 'Completed', 'Pending')),
    description TEXT,
    type TEXT CHECK (type IN ('Allocation', 'Time off', 'Status')),
    timeOffType TEXT CHECK (timeOffType IN ('Medical Leave', 'Annual Leave', 'Unpaid Leave')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
