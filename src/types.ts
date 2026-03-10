export type ViewType = 'schedule' | 'project-plan' | 'people' | 'projects';

export interface Staff {
  id: string;
  name: string;
  role: string;
  department: string;
  location: string;
  avatar?: string;
  weeklyAllocation: number; // in hours
  maxHours: number;
  initials: string;
}

export interface Project {
  id: string;
  name: string;
  code: string;
  client: string;
  ownerId: string;
  stage: 'Confirmed' | 'Tentative' | 'On Hold';
  billable: boolean;
  tags: string[];
  startDate: string;
  endDate: string;
  notes?: string;
  totalAllocation: number; // percentage
  teamSize: number;
  color: string;
}

export interface Task {
  id: string;
  projectId: string;
  staffId: string;
  title: string;
  startDate: string;
  endDate: string;
  hoursPerDay: number;
  status: 'In Progress' | 'Completed' | 'Pending';
  description?: string;
  type?: 'Allocation' | 'Time off' | 'Status';
  timeOffType?: 'Medical Leave' | 'Annual Leave' | 'Unpaid Leave';
}
