import { Project, Staff, Task } from './types';
import data from './data.json';

export const MOCK_STAFF: Staff[] = data.staff as Staff[];
export const MOCK_PROJECTS: Project[] = data.projects as Project[];
export const MOCK_TASKS: Task[] = data.tasks as Task[];
