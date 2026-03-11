-- SQL script to rename columns to camelCase with double quotes to match frontend types

-- 1. Fix Staff table
ALTER TABLE public.staff RENAME COLUMN weeklyallocation TO "weeklyAllocation";
ALTER TABLE public.staff RENAME COLUMN maxhours TO "maxHours";

-- 2. Fix Projects table
ALTER TABLE public.projects RENAME COLUMN ownerid TO "ownerId";
ALTER TABLE public.projects RENAME COLUMN startdate TO "startDate";
ALTER TABLE public.projects RENAME COLUMN enddate TO "endDate";
ALTER TABLE public.projects RENAME COLUMN totalallocation TO "totalAllocation";
ALTER TABLE public.projects RENAME COLUMN teamsize TO "teamSize";

-- 3. Fix Tasks table
ALTER TABLE public.tasks RENAME COLUMN projectid TO "projectId";
ALTER TABLE public.tasks RENAME COLUMN staffid TO "staffId";
ALTER TABLE public.tasks RENAME COLUMN startdate TO "startDate";
ALTER TABLE public.tasks RENAME COLUMN enddate TO "endDate";
ALTER TABLE public.tasks RENAME COLUMN hoursperday TO "hoursPerDay";
ALTER TABLE public.tasks RENAME COLUMN timeofftype TO "timeOffType";
