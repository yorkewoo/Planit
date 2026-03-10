import React, { useState, useMemo, useEffect, useRef } from 'react';
import { 
  Calendar, 
  LayoutGrid, 
  Users, 
  FolderOpen, 
  Settings, 
  Bell, 
  Plus, 
  Search, 
  Filter, 
  Download, 
  ChevronRight, 
  ChevronLeft,
  MoreHorizontal,
  Hexagon,
  CheckCircle2,
  Building2,
  Tag,
  CalendarDays,
  Wallet,
  Receipt,
  Users2,
  X,
  Edit,
  Trash2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { ViewType, Staff, Project, Task } from './types';
import { MOCK_STAFF, MOCK_PROJECTS, MOCK_TASKS } from './constants';
import { getObservedHolidays } from './holidays';

// --- Constants ---
const TIMELINE_DAYS = 520; // ~2 years of weekdays
const OBSERVED_HOLIDAYS = getObservedHolidays();

// --- Helpers ---
const formatDate = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const getWeekNumber = (date: Date) => {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
};

const getTimelineDates = (startDate: Date) => {
  const dates: Date[] = [];
  const d = new Date(startDate);
  while (dates.length < TIMELINE_DAYS) {
    const day = d.getDay();
    if (day !== 0 && day !== 6) {
      dates.push(new Date(d));
    }
    d.setDate(d.getDate() + 1);
  }
  return dates;
};

const getDayPosition = (date: Date | string, timelineDates: Date[], pixelsPerDay: number) => {
  const d = typeof date === 'string' ? new Date(date) : date;
  const dateStr = formatDate(d);
  const index = timelineDates.findIndex(dt => formatDate(dt) === dateStr);
  
  if (index === -1) {
    const firstWeekdayIndex = timelineDates.findIndex(dt => dt >= d);
    return firstWeekdayIndex !== -1 ? firstWeekdayIndex * pixelsPerDay : -1;
  }
  
  // If it's a string (from task data), we just return the start of the day
  if (typeof date === 'string') {
    return index * pixelsPerDay;
  }
  
  // If it's a Date object (like new Date()), we include the time of day for accuracy
  const hours = d.getHours();
  const minutes = d.getMinutes();
  const dayProgress = (hours + minutes / 60) / 24;
  return (index + dayProgress) * pixelsPerDay;
};

const getTaskWidth = (startDate: string, endDate: string, timelineDates: Date[], pixelsPerDay: number) => {
  const count = timelineDates.filter(d => {
    const dStr = formatDate(d);
    return dStr >= startDate && dStr <= endDate;
  }).length;
  return count * pixelsPerDay;
};

const getPreviousDay = (dateStr: string, timelineDates: Date[]) => {
  const index = timelineDates.findIndex(d => formatDate(d) === dateStr);
  if (index > 0) return formatDate(timelineDates[index - 1]);
  return dateStr;
};

const getNextDay = (dateStr: string, timelineDates: Date[]) => {
  const index = timelineDates.findIndex(d => formatDate(d) === dateStr);
  if (index !== -1 && index < timelineDates.length - 1) return formatDate(timelineDates[index + 1]);
  return dateStr;
};

interface TaskSegment {
  startDate: string;
  endDate: string;
  left: number;
  width: number;
  isFirst: boolean;
  isLast: boolean;
}

const getTaskSegments = (startDate: string, endDate: string, timelineDates: Date[], pixelsPerDay: number): TaskSegment[] => {
  const segments: TaskSegment[] = [];
  let currentSegmentStart: string | null = null;
  let currentSegmentEnd: string | null = null;
  
  const taskDates = timelineDates.filter(d => {
    const dStr = formatDate(d);
    return dStr >= startDate && dStr <= endDate;
  });

  if (taskDates.length === 0) return segments;

  for (let i = 0; i < taskDates.length; i++) {
    const dStr = formatDate(taskDates[i]);
    const isHoliday = OBSERVED_HOLIDAYS.has(dStr);

    if (!isHoliday) {
      if (!currentSegmentStart) {
        currentSegmentStart = dStr;
      }
      currentSegmentEnd = dStr;
    } else {
      if (currentSegmentStart && currentSegmentEnd) {
        segments.push({
          startDate: currentSegmentStart,
          endDate: currentSegmentEnd,
          left: getDayPosition(currentSegmentStart, timelineDates, pixelsPerDay),
          width: getTaskWidth(currentSegmentStart, currentSegmentEnd, timelineDates, pixelsPerDay),
          isFirst: false,
          isLast: false
        });
        currentSegmentStart = null;
        currentSegmentEnd = null;
      }
    }
  }

  if (currentSegmentStart && currentSegmentEnd) {
    segments.push({
      startDate: currentSegmentStart,
      endDate: currentSegmentEnd,
      left: getDayPosition(currentSegmentStart, timelineDates, pixelsPerDay),
      width: getTaskWidth(currentSegmentStart, currentSegmentEnd, timelineDates, pixelsPerDay),
      isFirst: false,
      isLast: false
    });
  }

  if (segments.length > 0) {
    segments[0].isFirst = true;
    segments[segments.length - 1].isLast = true;
  }

  return segments;
};

const getTaskPositions = (personTasks: Task[], heightMultiplier: number, minTop: number = 8, gap: number = 4) => {
  const sortedTasks = [...personTasks].sort((a, b) => {
    const dateCompare = a.startDate.localeCompare(b.startDate);
    if (dateCompare !== 0) return dateCompare;
    return b.hoursPerDay - a.hoursPerDay;
  });
  
  const positions: Record<string, { top: number, height: number }> = {};
  const placed: { task: Task, top: number, bottom: number }[] = [];
  let maxBottom = 0;

  sortedTasks.forEach(task => {
    const height = task.hoursPerDay * heightMultiplier;
    let currentTop = minTop;
    
    const overlappingInTime = placed.filter(p => 
      task.startDate <= p.task.endDate && task.endDate >= p.task.startDate
    );

    overlappingInTime.sort((a, b) => a.top - b.top);
    
    for (const p of overlappingInTime) {
      if (currentTop < p.bottom + gap && currentTop + height + gap > p.top) {
        currentTop = p.bottom + gap;
      }
    }

    positions[task.id] = { top: currentTop, height };
    placed.push({ task, top: currentTop, bottom: currentTop + height });
    if (currentTop + height > maxBottom) {
      maxBottom = currentTop + height;
    }
  });

  return { positions, maxBottom };
};

const getDateAtX = (x: number, timelineDates: Date[], pixelsPerDay: number) => {
  const index = Math.floor(x / pixelsPerDay);
  if (index >= 0 && index < timelineDates.length) {
    return formatDate(timelineDates[index]);
  }
  return null;
};

const useDragScroll = (ref: React.RefObject<HTMLDivElement>) => {
  const isDragging = React.useRef(false);
  const startX = React.useRef(0);
  const scrollLeftStart = React.useRef(0);

  const onMouseDown = (e: React.MouseEvent) => {
    if (!ref.current) return;
    // Only drag if clicking on the timeline area, not on buttons/inputs/interactive elements
    if ((e.target as HTMLElement).closest('button') || (e.target as HTMLElement).closest('input') || (e.target as HTMLElement).closest('select')) return;
    
    isDragging.current = true;
    startX.current = e.pageX - ref.current.offsetLeft;
    scrollLeftStart.current = ref.current.scrollLeft;
    ref.current.style.cursor = 'grabbing';
    ref.current.style.userSelect = 'none';
  };

  const onMouseLeave = () => {
    if (!isDragging.current) return;
    isDragging.current = false;
    if (ref.current) {
      ref.current.style.cursor = 'default';
      ref.current.style.userSelect = 'auto';
    }
  };

  const onMouseUp = () => {
    if (!isDragging.current) return;
    isDragging.current = false;
    if (ref.current) {
      ref.current.style.cursor = 'default';
      ref.current.style.userSelect = 'auto';
    }
  };

  const onMouseMove = (e: React.MouseEvent) => {
    if (!isDragging.current || !ref.current) return;
    e.preventDefault();
    const x = e.pageX - ref.current.offsetLeft;
    const walk = (x - startX.current) * 1.5; // Scroll speed multiplier
    ref.current.scrollLeft = scrollLeftStart.current - walk;
  };

  return { onMouseDown, onMouseLeave, onMouseUp, onMouseMove };
};

// --- Components ---

const Sidebar = ({ currentView, setView }: { currentView: ViewType, setView: (v: ViewType) => void }) => {
  const navItems = [
    { id: 'schedule', label: 'Schedule', icon: 'calendar_today' },
    { id: 'project-plan', label: 'Project Plan', icon: 'list_alt' },
    { id: 'people', label: 'People', icon: 'people' },
    { id: 'projects', label: 'Projects', icon: 'folder' },
  ];

  return (
    <aside className="w-16 bg-surface-light border-r border-border-light flex flex-col items-center py-4 space-y-6 z-40 shadow-soft shrink-0">
      <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center text-white font-bold text-xl cursor-pointer">
        S
      </div>
      <nav className="flex flex-col space-y-2 w-full items-center">
        {navItems.map((item) => (
          <button
            key={item.id}
            onClick={() => setView(item.id as ViewType)}
            className={`w-10 h-10 flex items-center justify-center rounded-lg transition-colors group relative ${
              currentView === item.id 
                ? 'text-primary bg-blue-50' 
                : 'text-slate-400 hover:text-primary hover:bg-slate-100'
            }`}
          >
            <span className="material-symbols-outlined">{item.icon}</span>
            <div className="absolute left-full ml-2 px-2 py-1 bg-gray-800 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-50 pointer-events-none">
              {item.label}
            </div>
          </button>
        ))}
      </nav>
      <div className="mt-auto flex flex-col space-y-4 items-center w-full pb-2">
        <button className="w-10 h-10 flex items-center justify-center text-slate-400 hover:bg-slate-100 rounded-lg transition-colors group relative">
          <span className="material-symbols-outlined">settings</span>
          <div className="absolute left-full ml-2 px-2 py-1 bg-gray-800 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-50 pointer-events-none">Settings</div>
        </button>
        <button className="w-10 h-10 flex items-center justify-center text-slate-400 hover:bg-slate-100 rounded-lg transition-colors group relative">
          <span className="material-symbols-outlined">notifications</span>
          <div className="absolute left-full ml-2 px-2 py-1 bg-gray-800 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-50 pointer-events-none">Notifications</div>
        </button>
        <div className="relative group">
          <img 
            alt="User Profile" 
            className="w-8 h-8 rounded-full border border-border-light cursor-pointer" 
            src="https://lh3.googleusercontent.com/aida-public/AB6AXuDavGzwJXZfQirWAUGAERQDbQkh2zRM50ox-p8Qklp-7UFRxU1bwzfsYv_T_40NHb1PSapfLY5PpLH53D7VdQL46n4xzqIA3ZXq78W-BGM3JpkntOjzTNjauBXFnGrnu-hNE0Uo-WSx9J8eqO4ubJf5Xl8h0XT8hGm_csCykNu8wwyUPJx7unnr90OfPclyOk-sQFinUf0oJOBUGRFWGroRhqVACr-DfVECUtzitpsGoB9J_i17vv0imxVZYVR-hT0vd2_fGcUzYoQ"
          />
          <div className="absolute left-full ml-4 px-2 py-1 bg-gray-800 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-50 pointer-events-none">Profile</div>
        </div>
      </div>
    </aside>
  );
};

const ProjectsView = ({ projects, onAddProject }: { projects: Project[], onAddProject: () => void }) => {
  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <header className="h-16 border-b border-slate-200 bg-white flex items-center justify-between px-8 shrink-0">
        <h2 className="text-xl font-bold">Projects <span className="text-slate-400 font-normal ml-1">({projects.length})</span></h2>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input 
              className="pl-10 pr-4 py-2 bg-slate-100 border-none rounded-xl text-sm w-64 focus:ring-2 focus:ring-primary/20 outline-none" 
              placeholder="Search projects..." 
              type="text" 
            />
          </div>
          <button className="flex items-center gap-2 px-4 py-2 border border-slate-200 rounded-xl text-sm font-semibold hover:bg-slate-50 transition-colors">
            <Filter size={18} />
            Filter
          </button>
          <button className="p-2 border border-slate-200 rounded-xl hover:bg-slate-50">
            <Download size={18} />
          </button>
          <button 
            onClick={onAddProject}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-xl text-sm font-bold hover:bg-primary/90 transition-colors shadow-lg shadow-primary/20"
          >
            <Plus size={18} />
            Project
          </button>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-8 bg-slate-50/50">
        <div className="flex gap-8 border-b border-slate-200 mb-6">
          <button className="pb-4 text-sm font-bold border-b-2 border-primary text-primary">Active</button>
          <button className="pb-4 text-sm font-medium text-slate-500 hover:text-slate-700">Archived</button>
          <button className="pb-4 text-sm font-medium text-slate-500 hover:text-slate-700">All</button>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Project Name</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Code</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Client</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Tags</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Stage</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Allocation</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Team</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {projects.map((project) => (
                <tr key={project.id} className="hover:bg-slate-50 transition-colors group cursor-pointer">
                  <td className="px-6 py-4 relative">
                    <div className="absolute left-0 top-0 bottom-0 w-1" style={{ backgroundColor: project.color }}></div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-slate-900">{project.name}</span>
                      <ChevronRight size={14} className="text-slate-400" />
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-500">{project.code}</td>
                  <td className="px-6 py-4 text-sm text-slate-900">{project.client}</td>
                  <td className="px-6 py-4">
                    {project.tags.map(tag => (
                      <span key={tag} className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-800 mr-1">
                        {tag}
                      </span>
                    ))}
                  </td>
                  <td className="px-6 py-4">
                    <div className="w-6 h-6 flex items-center justify-center rounded-md" style={{ color: project.color, backgroundColor: `${project.color}15` }}>
                      <Hexagon size={18} fill="currentColor" />
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="flex-1 h-1.5 bg-slate-200 rounded-full overflow-hidden w-24">
                        <div className="h-full bg-primary rounded-full" style={{ width: `${project.totalAllocation}%` }}></div>
                      </div>
                      <span className="text-xs font-bold">{project.totalAllocation}%</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm font-semibold">{project.teamSize}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
            <p className="text-xs text-slate-500 font-medium tracking-wide uppercase">Showing {projects.length} active projects</p>
            <div className="flex gap-2">
              <button className="p-1 border border-slate-200 rounded-lg hover:bg-white disabled:opacity-50" disabled><ChevronLeft size={16} /></button>
              <button className="p-1 border border-slate-200 rounded-lg hover:bg-white"><ChevronRight size={16} /></button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const PeopleView = ({ staff, onAddPerson, onEditPerson, onDeletePerson }: { staff: Staff[], onAddPerson: () => void, onEditPerson: (s: Staff) => void, onDeletePerson: (id: string) => void }) => {
  const [activeMenu, setActiveMenu] = useState<string | null>(null);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = () => setActiveMenu(null);
    window.addEventListener('click', handleClickOutside);
    return () => window.removeEventListener('click', handleClickOutside);
  }, []);

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <header className="px-8 py-6 border-b border-slate-200 bg-white shrink-0">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">People</h1>
            <p className="mt-1 text-sm text-gray-500">Manage your team members, departments, and capacity.</p>
          </div>
          <div className="flex items-center space-x-3">
            <button className="inline-flex items-center px-4 py-2 border border-slate-200 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50">
              <Download size={18} className="mr-2" />
              Export
            </button>
            <button 
              onClick={onAddPerson}
              className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-primary hover:bg-primary/90 transition-colors"
            >
              <Plus size={18} className="mr-2" />
              Add Person
            </button>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="relative max-w-xs w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input className="w-full pl-9 pr-3 py-2 text-sm border border-slate-300 rounded-md focus:ring-primary focus:border-primary outline-none" placeholder="Search people..." type="text" />
          </div>
          <select className="border-slate-300 rounded-md text-sm font-medium px-3 py-2 outline-none">
            <option>All Departments</option>
            <option>Product Design</option>
            <option>Interactive Media</option>
          </select>
          <select className="border-slate-300 rounded-md text-sm font-medium px-3 py-2 outline-none">
            <option>All Locations</option>
            <option>Indonesia</option>
            <option>Singapore</option>
          </select>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-8 bg-slate-50/50">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {staff.map((person) => (
            <div key={person.id} className="bg-white rounded-lg border border-slate-200 shadow-sm hover:shadow-md transition-shadow group relative flex flex-col h-full">
              <div className="absolute top-4 right-4 z-10">
                <button 
                  className="text-gray-400 hover:text-gray-600 p-1 rounded-full hover:bg-slate-100 transition-colors"
                  onClick={(e) => {
                    e.stopPropagation();
                    setActiveMenu(activeMenu === person.id ? null : person.id);
                  }}
                >
                  <MoreHorizontal size={20} />
                </button>
                {activeMenu === person.id && (
                  <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg border border-slate-200 py-1 z-20">
                    <button 
                      onClick={() => {
                        onEditPerson(person);
                        setActiveMenu(null);
                      }}
                      className="flex items-center w-full px-4 py-2 text-sm text-gray-700 hover:bg-slate-50"
                    >
                      <Edit size={14} className="mr-2" />
                      Edit Member
                    </button>
                    <button 
                      onClick={() => {
                        onDeletePerson(person.id);
                        setActiveMenu(null);
                      }}
                      className="flex items-center w-full px-4 py-2 text-sm text-red-600 hover:bg-red-50"
                    >
                      <Trash2 size={14} className="mr-2" />
                      Delete Member
                    </button>
                  </div>
                )}
              </div>
              <div className="p-6 flex flex-col items-center flex-grow">
                <div className="relative mb-3">
                  {person.avatar ? (
                    <img src={person.avatar} className="h-20 w-20 rounded-full object-cover border-2 border-white shadow-sm" alt={person.name} />
                  ) : (
                    <div className="h-20 w-20 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 text-xl font-bold border-2 border-white shadow-sm">
                      {person.initials}
                    </div>
                  )}
                  <span className="absolute bottom-0 right-0 block h-4 w-4 rounded-full ring-2 ring-white bg-green-400"></span>
                </div>
                <h3 className="text-lg font-bold text-gray-900 text-center">{person.name}</h3>
                <p className="text-sm font-medium text-primary mt-1">{person.role}</p>
                <div className="mt-4 flex flex-col items-center space-y-1 w-full">
                  <div className="flex items-center text-sm text-gray-500">
                    <Building2 size={14} className="mr-1.5" />
                    <span>{person.department}</span>
                  </div>
                  <div className="flex items-center text-sm text-gray-500">
                    <Tag size={14} className="mr-1.5" />
                    <span>{person.location}</span>
                  </div>
                </div>
              </div>
              <div className="border-t border-slate-100 p-4 bg-slate-50/50 rounded-b-lg mt-auto">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-xs font-medium text-gray-500">Weekly Allocation</span>
                  <span className="text-xs font-semibold text-gray-900">{person.weeklyAllocation}h / {person.maxHours}h</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div 
                    className={`h-2 rounded-full ${person.weeklyAllocation >= person.maxHours ? 'bg-red-500' : 'bg-primary'}`} 
                    style={{ width: `${(person.weeklyAllocation / person.maxHours) * 100}%` }}
                  ></div>
                </div>
              </div>
            </div>
          ))}
          <div 
            onClick={onAddPerson}
            className="bg-white rounded-lg border-2 border-dashed border-slate-200 hover:border-primary hover:bg-blue-50 cursor-pointer flex flex-col items-center justify-center p-6 text-center transition-colors h-full min-h-[280px]"
          >
            <div className="h-12 w-12 rounded-full bg-blue-100 flex items-center justify-center mb-4">
              <Plus size={24} className="text-primary" />
            </div>
            <h3 className="text-lg font-medium text-gray-900">Add Team Member</h3>
            <p className="mt-1 text-sm text-gray-500">Invite a new person to the team.</p>
          </div>
        </div>
      </div>
    </div>
  );
};

const AddProjectModal = ({ isOpen, onClose, onCreate }: { isOpen: boolean, onClose: () => void, onCreate: (p: Partial<Project>) => void }) => {
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [client, setClient] = useState('');
  const [ownerId, setOwnerId] = useState('Yorke Wu');
  const [stage, setStage] = useState<'Confirmed' | 'Tentative' | 'On Hold'>('Confirmed');
  const [tags, setTags] = useState('');
  const [notes, setNotes] = useState('');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !code) return;
    
    onCreate({
      name,
      code,
      client,
      ownerId,
      stage,
      tags: tags.split(',').map(t => t.trim()).filter(t => t !== ''),
      notes,
      billable: true, // Default
      startDate: formatDate(new Date()), // Default
      endDate: formatDate(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)), // Default +30 days
      totalAllocation: 0,
      teamSize: 0,
      color: '#' + Math.floor(Math.random()*16777215).toString(16).padStart(6, '0') // Random color
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white rounded-xl shadow-2xl w-[640px] max-w-[90vw] overflow-hidden border border-slate-200"
      >
        <div className="px-6 py-4 border-b border-slate-200 flex justify-between items-center">
          <h2 className="text-lg font-bold">Create New Project</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={20} /></button>
        </div>
        <div className="p-6 overflow-y-auto max-h-[80vh]">
          <form className="space-y-6" id="add-project-form" onSubmit={handleSubmit}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-700">Project Name</label>
                <input 
                  className="w-full px-4 py-2.5 rounded-lg border border-slate-300 bg-transparent focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all" 
                  placeholder="Enter project name" 
                  type="text" 
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-700">Project Code</label>
                <input 
                  className="w-full px-4 py-2.5 rounded-lg border border-slate-300 bg-transparent focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all" 
                  placeholder="e.g. PRJ-2024-01" 
                  type="text" 
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-700">Owner</label>
                <select 
                  className="w-full px-4 py-2.5 rounded-lg border border-slate-300 bg-transparent focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
                  value={ownerId}
                  onChange={(e) => setOwnerId(e.target.value)}
                >
                  <option>Yorke Wu</option>
                  <option>Sarah Chen</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-700">Stage</label>
                <select 
                  className="w-full px-4 py-2.5 rounded-lg border border-slate-300 bg-transparent focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
                  value={stage}
                  onChange={(e) => setStage(e.target.value as any)}
                >
                  <option value="Confirmed">Confirmed</option>
                  <option value="Tentative">Tentative</option>
                  <option value="On Hold">On Hold</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-700">Client</label>
                <input 
                  className="w-full px-4 py-2.5 rounded-lg border border-slate-300 bg-transparent focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all" 
                  placeholder="Enter client name" 
                  type="text" 
                  value={client}
                  onChange={(e) => setClient(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-700">Tags</label>
                <input 
                  className="w-full px-4 py-2.5 rounded-lg border border-slate-300 bg-transparent focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all" 
                  placeholder="Add tags (separated by commas)" 
                  type="text" 
                  value={tags}
                  onChange={(e) => setTags(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-700">Notes</label>
              <textarea 
                className="w-full px-4 py-3 min-h-[100px] rounded-lg border border-slate-300 bg-transparent focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all" 
                placeholder="Optional project description..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              ></textarea>
            </div>
          </form>
        </div>
        <div className="px-6 py-4 bg-slate-50 flex justify-end gap-3 border-t border-slate-200">
          <button type="button" onClick={onClose} className="px-6 py-2.5 text-sm font-bold text-slate-600 hover:bg-slate-200 rounded-lg transition-all">Cancel</button>
          <button type="submit" form="add-project-form" className="px-8 py-2.5 text-sm font-bold bg-blue-500 hover:bg-blue-600 text-white rounded-lg shadow-sm shadow-blue-500/20 transition-all">Create project</button>
        </div>
      </motion.div>
    </div>
  );
};

const ScheduleView = ({ 
  staff, 
  tasks, 
  projects, 
  onTaskClick, 
  onAddTask,
  onAddTaskImmediate,
  onUpdateTask,
  onDeleteTask,
  timelineDates,
  timelineStartDate,
  scrollLeft,
  onScroll,
  pixelsPerDay,
  zoomLevel,
  onZoomChange,
  dailyAllocations,
  onAddPerson,
  onAddProject,
  selectedDepartment,
  onDepartmentChange
}: { 
  staff: Staff[], 
  tasks: Task[], 
  projects: Project[], 
  onTaskClick: (t: Task) => void, 
  onAddTask: (initials?: Partial<Task>) => void,
  onAddTaskImmediate: (task: Partial<Task>) => void,
  onUpdateTask: (taskId: string, updates: Partial<Task>) => void,
  onDeleteTask: (taskId: string) => void,
  timelineDates: Date[],
  timelineStartDate: Date,
  scrollLeft: number,
  onScroll: (s: number) => void,
  pixelsPerDay: number,
  zoomLevel: 'days' | 'weeks' | 'months',
  onZoomChange: (z: 'days' | 'weeks' | 'months') => void,
  dailyAllocations: Record<string, Record<string, number>>,
  onAddPerson: () => void,
  onAddProject: () => void,
  selectedDepartment: string,
  onDepartmentChange: (d: string) => void
}) => {
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const [isZoomDropdownOpen, setIsZoomDropdownOpen] = React.useState(false);
  const [isAddDropdownOpen, setIsAddDropdownOpen] = React.useState(false);
  const dragHandlers = useDragScroll(scrollRef);
  const [resizing, setResizing] = React.useState<{ 
    id: string, 
    edge: 'left' | 'right' | 'bottom', 
    startX: number, 
    startY: number, 
    initialStartDate?: string,
    initialEndDate?: string,
    initialHours?: number 
  } | null>(null);
  const [dragging, setDragging] = React.useState<{
    id: string,
    startX: number,
    initialStartDate: string,
    initialEndDate: string,
    staffId: string
  } | null>(null);
  const hasMovedRef = React.useRef(false);
  const [contextMenu, setContextMenu] = React.useState<{
    x: number,
    y: number,
    task: Task,
    date: string
  } | null>(null);

  const { rowHeights, taskPositions } = React.useMemo(() => {
    const heights: Record<string, number> = {};
    const positions: Record<string, { top: number, height: number }> = {};
    
    staff.forEach(person => {
      const personTasks = tasks.filter(t => t.staffId === person.id);
      const { positions: personPositions, maxBottom } = getTaskPositions(personTasks, 14, 8, 4);
      
      Object.assign(positions, personPositions);
      heights[person.id] = Math.max(144, maxBottom + 16); // 144 is h-36, 16 for padding
    });
    
    return { rowHeights: heights, taskPositions: positions };
  }, [staff, tasks]);

  const handleResizeStart = (e: React.MouseEvent, task: Task, edge: 'left' | 'right' | 'bottom') => {
    e.preventDefault();
    e.stopPropagation();
    hasMovedRef.current = false;
    setResizing({ 
      id: task.id, 
      edge, 
      startX: e.pageX, 
      startY: e.pageY,
      initialStartDate: task.startDate,
      initialEndDate: task.endDate,
      initialHours: task.hoursPerDay
    });
  };

  const handleDragStart = (e: React.MouseEvent, task: Task) => {
    e.preventDefault();
    e.stopPropagation();
    hasMovedRef.current = false;
    setDragging({
      id: task.id,
      startX: e.pageX,
      initialStartDate: task.startDate,
      initialEndDate: task.endDate,
      staffId: task.staffId
    });
  };

  const handleTaskSplit = (task: Task, splitDate: string) => {
    if (splitDate <= task.startDate || splitDate > task.endDate) return;
    
    const preEnd = getPreviousDay(splitDate, timelineDates);
    
    // Update original task to end before split
    onUpdateTask(task.id, { endDate: preEnd });
    
    // Add new task starting at split
    onAddTaskImmediate({
      ...task,
      id: undefined, // Let handleAddTask generate new ID
      startDate: splitDate,
      endDate: task.endDate,
      title: task.title
    });
  };

  React.useEffect(() => {
    const handleGlobalMouseMove = (e: MouseEvent) => {
      if (resizing) {
        hasMovedRef.current = true;
        if (resizing.edge === 'bottom') {
          const deltaY = e.pageY - resizing.startY;
          const deltaHours = deltaY / 14;
          const newHours = Math.max(0.5, Math.min(24, (resizing.initialHours || 8) + deltaHours));
          onUpdateTask(resizing.id, { hoursPerDay: Math.round(newHours * 2) / 2 });
        } else if (resizing.edge === 'left' || resizing.edge === 'right') {
          if (!scrollRef.current) return;
          
          const rect = scrollRef.current.getBoundingClientRect();
          const xInTimeline = e.pageX - rect.left + scrollRef.current.scrollLeft - 256;
          const dateAtX = getDateAtX(xInTimeline, timelineDates, pixelsPerDay);
          
          if (dateAtX) {
            if (resizing.edge === 'left') {
              if (dateAtX <= (resizing.initialEndDate || '')) {
                onUpdateTask(resizing.id, { startDate: dateAtX });
              }
            } else {
              if (dateAtX >= (resizing.initialStartDate || '')) {
                onUpdateTask(resizing.id, { endDate: dateAtX });
              }
            }
          }
        }
      } else if (dragging) {
        if (!scrollRef.current) return;
        hasMovedRef.current = true;
        
        const rect = scrollRef.current.getBoundingClientRect();
        const deltaX = e.pageX - dragging.startX;
        const daysMoved = Math.round(deltaX / pixelsPerDay);
        
        if (daysMoved !== 0) {
          const startIndex = timelineDates.findIndex(d => formatDate(d) === dragging.initialStartDate);
          const endIndex = timelineDates.findIndex(d => formatDate(d) === dragging.initialEndDate);
          
          if (startIndex !== -1 && endIndex !== -1) {
            const newStartIndex = Math.max(0, Math.min(timelineDates.length - 1, startIndex + daysMoved));
            const newEndIndex = Math.max(0, Math.min(timelineDates.length - 1, endIndex + daysMoved));
            
            const newStartDate = formatDate(timelineDates[newStartIndex]);
            const newEndDate = formatDate(timelineDates[newEndIndex]);
            
            onUpdateTask(dragging.id, { startDate: newStartDate, endDate: newEndDate });
          }
        }
      }
    };

    const handleGlobalMouseUp = () => {
      setResizing(null);
      setDragging(null);
    };

    if (resizing || dragging) {
      window.addEventListener('mousemove', handleGlobalMouseMove);
      window.addEventListener('mouseup', handleGlobalMouseUp);
    }

    return () => {
      window.removeEventListener('mousemove', handleGlobalMouseMove);
      window.removeEventListener('mouseup', handleGlobalMouseUp);
    };
  }, [resizing, dragging, onUpdateTask, timelineDates, pixelsPerDay]);

  React.useEffect(() => {
    if (scrollRef.current) {
      if (scrollLeft === 0) {
        const today = new Date();
        const day = today.getDay();
        const monday = new Date(today);
        monday.setDate(today.getDate() - (day === 0 ? 6 : day - 1));
        const prevMonday = new Date(monday);
        prevMonday.setDate(monday.getDate() - 7);
        
        const startPos = getDayPosition(formatDate(prevMonday), timelineDates, pixelsPerDay);
        const scrollPos = Math.max(0, startPos);
        scrollRef.current.scrollLeft = scrollPos;
        onScroll(scrollPos);
      } else {
        scrollRef.current.scrollLeft = scrollLeft;
      }
    }
  }, []);

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    onScroll(e.currentTarget.scrollLeft);
  };

  const scrollToToday = () => {
    if (scrollRef.current) {
      const today = new Date();
      const day = today.getDay();
      const monday = new Date(today);
      monday.setDate(today.getDate() - (day === 0 ? 6 : day - 1));
      const prevMonday = new Date(monday);
      prevMonday.setDate(monday.getDate() - 7);
      
      const scrollPos = getDayPosition(formatDate(prevMonday), timelineDates, pixelsPerDay);
      scrollRef.current.scrollTo({ left: scrollPos, behavior: 'smooth' });
    }
  };

  const scrollBy = (amount: number) => {
    if (scrollRef.current) {
      scrollRef.current.scrollBy({ left: amount * pixelsPerDay, behavior: 'smooth' });
    }
  };

  // Group dates by week for the header
  const weeks: { weekNumber: number, monthLabel: string, days: Date[] }[] = [];
  let currentWeek: Date[] = [];
  
  timelineDates.forEach((date, i) => {
    currentWeek.push(date);
    // Group by Friday or end of timeline
    if (date.getDay() === 5 || i === timelineDates.length - 1) {
      const start = currentWeek[0];
      const end = currentWeek[currentWeek.length - 1];
      const startMonth = start.toLocaleString('default', { month: 'short' });
      const endMonth = end.toLocaleString('default', { month: 'short' });
      const monthLabel = startMonth === endMonth ? startMonth : `${startMonth} - ${endMonth}`;
      weeks.push({
        weekNumber: getWeekNumber(start),
        monthLabel,
        days: currentWeek
      });
      currentWeek = [];
    }
  });
  
  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <header className="bg-surface-light border-b border-border-light p-4 flex items-center justify-between shrink-0 shadow-sm z-50 relative">
        <div className="flex items-center space-x-4">
          <h1 className="text-xl font-semibold text-text-main-light">Schedule</h1>
          <div className="h-6 w-px bg-border-light mx-2"></div>
          <div className="relative flex items-center">
            <span className="material-icons-outlined text-lg absolute left-2 text-slate-400 pointer-events-none">category</span>
            <select 
              value={selectedDepartment}
              onChange={(e) => onDepartmentChange(e.target.value)}
              className="pl-9 pr-8 py-1.5 border border-border-light rounded bg-white text-sm font-medium outline-none appearance-none hover:bg-slate-50 transition-colors cursor-pointer"
            >
              <option>All Departments</option>
              <option>Product Design</option>
              <option>Interactive Media</option>
              <option>Landscape Arch</option>
              <option>Architecture</option>
              <option>Engineering</option>
            </select>
            <span className="material-icons-outlined text-sm absolute right-2 text-slate-400 pointer-events-none">expand_more</span>
          </div>
          <button className="flex items-center space-x-1 px-3 py-1.5 border border-border-light rounded hover:bg-slate-50 text-sm font-medium transition-colors">
            <span className="material-icons-outlined text-lg">filter_list</span>
            <span>All Filters</span>
          </button>
          <div className="flex items-center border border-border-light rounded overflow-hidden">
            <button 
              onClick={() => scrollBy(-5)}
              className="px-3 py-1.5 hover:bg-slate-50 border-r border-border-light text-text-muted-light"
            >
              <span className="material-icons-outlined text-lg">chevron_left</span>
            </button>
            <button 
              onClick={scrollToToday}
              className="px-4 py-1.5 text-sm font-medium hover:bg-slate-50"
            >
              This week
            </button>
            <button 
              onClick={() => scrollBy(5)}
              className="px-3 py-1.5 hover:bg-slate-50 border-l border-border-light text-text-muted-light"
            >
              <span className="material-icons-outlined text-lg">chevron_right</span>
            </button>
          </div>
        </div>
        <div className="flex items-center space-x-3">
          <span className="text-xs font-semibold text-text-muted-light bg-slate-100 px-2 py-1 rounded">47.5h scheduled</span>
          <div className="h-6 w-px bg-border-light mx-2"></div>
          <button 
            onClick={scrollToToday}
            className="px-3 py-1.5 border border-border-light rounded hover:bg-slate-50 text-sm font-medium"
          >
            Today
          </button>
          <div className="relative">
            <button 
              onClick={() => setIsZoomDropdownOpen(!isZoomDropdownOpen)}
              className="flex items-center space-x-1 px-3 py-1.5 border border-border-light rounded hover:bg-slate-50 text-sm font-medium capitalize"
            >
              <span>{zoomLevel}</span>
              <span className="material-icons-outlined text-sm">expand_more</span>
            </button>
            <AnimatePresence>
              {isZoomDropdownOpen && (
                <motion.div 
                  key="dropdown"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 10 }}
                  className="absolute right-0 mt-1 w-32 bg-white border border-border-light rounded-md shadow-lg z-50 overflow-hidden"
                >
                  {(['days', 'weeks', 'months'] as const).map((z) => (
                    <button
                      key={z}
                      onClick={() => {
                        onZoomChange(z);
                        setIsZoomDropdownOpen(false);
                      }}
                      className={`w-full text-left px-4 py-2 text-sm hover:bg-slate-50 capitalize ${zoomLevel === z ? 'text-primary font-bold' : 'text-text-main-light'}`}
                    >
                      {z}
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
            {isZoomDropdownOpen && (
              <div className="fixed inset-0 z-40" onClick={() => setIsZoomDropdownOpen(false)}></div>
            )}
          </div>
          <div className="h-6 w-px bg-border-light mx-2"></div>
          <button className="p-1.5 text-text-muted-light hover:bg-slate-100 rounded transition-colors">
            <span className="material-icons-outlined">search</span>
          </button>
          <button className="p-1.5 text-text-muted-light hover:bg-slate-100 rounded transition-colors">
            <span className="material-icons-outlined">open_in_new</span>
          </button>
          <div className="relative">
            <button 
              onClick={() => setIsAddDropdownOpen(!isAddDropdownOpen)}
              className="w-8 h-8 bg-primary hover:bg-primary-dark text-white rounded flex items-center justify-center shadow-md transition-colors"
            >
              <span className="material-icons-outlined">add</span>
            </button>
            <AnimatePresence>
              {isAddDropdownOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setIsAddDropdownOpen(false)}></div>
                  <motion.div 
                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 10, scale: 0.95 }}
                    className="absolute right-0 mt-2 w-56 bg-white border border-border-light rounded-xl shadow-xl z-50 overflow-hidden py-1"
                  >
                    <button 
                      onClick={() => { onAddTask(); setIsAddDropdownOpen(false); }}
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
                    >
                      <span className="material-icons-outlined text-lg text-slate-400">event_available</span>
                      <span className="font-medium">Add Allocation</span>
                    </button>
                    <button 
                      onClick={() => { onAddProject(); setIsAddDropdownOpen(false); }}
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
                    >
                      <span className="material-icons-outlined text-lg text-slate-400">create_new_folder</span>
                      <span className="font-medium">Add Project</span>
                    </button>
                    <button 
                      onClick={() => { onAddPerson(); setIsAddDropdownOpen(false); }}
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
                    >
                      <span className="material-icons-outlined text-lg text-slate-400">person_add</span>
                      <span className="font-medium">Add People</span>
                    </button>
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          </div>
        </div>
      </header>

      <div 
        ref={scrollRef}
        onScroll={handleScroll}
        {...dragHandlers}
        className="flex-1 overflow-auto timeline-scroll bg-surface-light relative"
      >
        <div className="relative" style={{ width: timelineDates.length * pixelsPerDay + 256 }}>
          <div className="flex sticky-header bg-white z-40 shadow-sm border-b border-border-light">
            <div className="sticky-col w-64 min-w-[16rem] bg-white border-r border-border-light sticky-corner z-50 flex items-center px-4 py-2 justify-between">
              <div className="flex items-center space-x-2 text-text-muted-light">
                <span 
                  className="material-icons-outlined text-lg cursor-pointer hover:text-primary"
                  onClick={onAddPerson}
                >
                  person_add
                </span>
                <span className="material-icons-outlined text-lg cursor-pointer hover:text-primary">sort</span>
              </div>
              <span className="text-xs text-text-muted-light font-medium">{staff.length} People</span>
            </div>
            <div className="flex flex-1">
              {weeks.map((week, idx) => (
                <div key={idx} className="flex flex-col border-r border-border-light" style={{ width: week.days.length * pixelsPerDay }}>
                  <div className="h-6 flex items-center px-2 text-xs font-semibold text-text-muted-light border-b border-border-light bg-slate-50 relative">
                    <span className="absolute left-2">{week.weekNumber}</span>
                    <span className="w-full text-center">{week.monthLabel}</span>
                  </div>
                  <div className="h-10 flex">
                    {week.days.map((day, dIdx) => {
                      const isToday = formatDate(day) === formatDate(new Date());
                      const isFriday = day.getDay() === 5;
                      const isHoliday = OBSERVED_HOLIDAYS.has(formatDate(day));
                      return (
                        <div 
                          key={dIdx} 
                          className={`border-r ${isFriday ? 'border-r-2 border-slate-300' : 'border-border-light'} flex flex-col justify-center items-center text-[10px] shrink-0 text-text-muted-light ${isToday ? 'bg-blue-50/30 border-t-2 border-t-primary' : ''} ${isHoliday ? 'holiday-hatch' : ''}`}
                          style={{ width: pixelsPerDay }}
                        >
                          <span className={`${isToday ? 'text-primary font-bold' : ''}`}>{['S','M','T','W','T','F','S'][day.getDay()]}</span>
                          <span className={`flex items-center justify-center w-6 h-6 rounded-full mt-0.5 ${isToday ? 'bg-primary text-white font-bold' : 'text-text-main-light'}`}>
                            {day.getDate()}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex flex-col">
            {staff.map(person => (
              <div 
                key={person.id} 
                className="flex border-b border-border-light group hover:bg-slate-50 transition-colors"
                style={{ height: rowHeights[person.id] }}
              >
                <div className="sticky-col w-64 min-w-[16rem] bg-surface-light border-r border-border-light z-30 p-4 flex flex-col justify-center group-hover:bg-slate-50">
                  <div className="flex items-start space-x-3">
                    {person.avatar ? (
                      <img src={person.avatar} className="w-10 h-10 rounded-full border border-border-light shrink-0" alt={person.name} />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold text-sm shrink-0">
                        {person.initials}
                      </div>
                    )}
                    <div className="flex flex-col min-w-0 flex-1">
                      <div className="flex items-center justify-between w-full space-x-2">
                        <h3 className="font-semibold text-sm text-text-main-light truncate">{person.name}</h3>
                        <span className="text-xs text-text-muted-light shrink-0">{person.weeklyAllocation}h</span>
                      </div>
                      <div className="mt-1 flex flex-col space-y-0.5">
                        <p className="text-[11px] font-medium text-text-main-light">{person.role}</p>
                        <p className="text-[11px] text-text-muted-light">{person.department}</p>
                        <p className="text-[11px] text-text-muted-light">{person.location}</p>
                      </div>
                    </div>
                  </div>
                </div>
                <div 
                  className="flex-1 relative py-2 px-0 cursor-crosshair"
                  onClick={(e) => {
                    const rect = e.currentTarget.getBoundingClientRect();
                    const x = e.clientX - rect.left;
                    const date = getDateAtX(x, timelineDates, pixelsPerDay);
                    if (date && !OBSERVED_HOLIDAYS.has(date)) {
                      onAddTask({ staffId: person.id, startDate: date, endDate: date, title: 'New Allocation' });
                    }
                  }}
                  style={{
                    backgroundImage: `
                      linear-gradient(to right, transparent ${pixelsPerDay - 1}px, rgba(226, 232, 240, 0.8) ${pixelsPerDay - 1}px),
                      linear-gradient(to right, transparent ${pixelsPerDay * 5 - 2}px, rgba(203, 213, 225, 0.9) ${pixelsPerDay * 5 - 2}px)
                    `,
                    backgroundSize: `${pixelsPerDay}px 100%, ${pixelsPerDay * 5}px 100%`,
                    backgroundPosition: `0 0, -${(timelineDates[0].getDay() - 1) * pixelsPerDay}px 0`
                  }}
                >
                  {/* Over-allocation and holiday background layer */}
                  <div className="absolute inset-0 pointer-events-none flex">
                    {timelineDates.map((date, i) => {
                      const dStr = formatDate(date);
                      const isHoliday = OBSERVED_HOLIDAYS.has(dStr);
                      const totalHours = dailyAllocations[person.id]?.[dStr] || 0;
                      
                      return (
                        <React.Fragment key={i}>
                          {isHoliday && (
                            <div 
                              className="absolute top-0 bottom-0 holiday-hatch z-0"
                              style={{ left: i * pixelsPerDay, width: pixelsPerDay }}
                            />
                          )}
                          {totalHours > 8 && (
                            <div 
                              className="absolute top-0 bottom-0 bg-red-500/20 border-x border-red-500/30 z-0" 
                              style={{ left: i * pixelsPerDay, width: pixelsPerDay }}
                            />
                          )}
                        </React.Fragment>
                      );
                    })}
                  </div>

                  {tasks.filter(t => t.staffId === person.id).map(task => {
                    const project = projects.find(p => p.id === task.projectId);
                    const segments = getTaskSegments(task.startDate, task.endDate, timelineDates, pixelsPerDay);
                    
                    if (segments.length === 0) return null;
                    
                    // Use project color if available, otherwise fallback to defaults
                    const isTimeOff = task.type === 'Time off';
                    const projectColor = isTimeOff ? '#ef4444' : (project?.color || '#94a3b8');
                    const isResizing = resizing?.id === task.id;
                    const pos = taskPositions[task.id] || { top: 8, height: task.hoursPerDay * 14 };

                    return (
                      <React.Fragment key={task.id}>
                        {segments.map((segment, idx) => (
                          <div 
                            key={`${task.id}-${idx}`}
                            onMouseDown={(e) => handleDragStart(e, task)}
                            onContextMenu={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              const rect = scrollRef.current?.getBoundingClientRect();
                              if (!rect) return;
                              const xInTimeline = e.pageX - rect.left + scrollRef.current!.scrollLeft - 256;
                              const dateAtX = getDateAtX(xInTimeline, timelineDates, pixelsPerDay);
                              if (dateAtX) {
                                setContextMenu({ x: e.pageX, y: e.pageY, task, date: dateAtX });
                              }
                            }}
                            onClick={(e) => { 
                              e.stopPropagation(); 
                              if (hasMovedRef.current) {
                                hasMovedRef.current = false;
                                return;
                              }
                              onTaskClick(task); 
                            }}
                            className={`absolute rounded shadow-md cursor-grab active:cursor-grabbing hover:brightness-95 flex flex-col p-1.5 overflow-hidden border-l-4 group/task z-10 ${isResizing ? 'ring-2 ring-primary z-20' : ''} ${dragging?.id === task.id ? 'opacity-50 z-30' : ''} ${isTimeOff ? 'time-off-hatch' : ''}`}
                            style={{ 
                              left: segment.left, 
                              width: segment.width, 
                              top: `${pos.top}px`,
                              height: `${pos.height}px`,
                              backgroundColor: isTimeOff ? 'transparent' : projectColor, 
                              borderColor: projectColor,
                              color: 'white',
                            }}
                          >
                            <span className="text-[10px] font-normal truncate leading-tight">{task.title}</span>
                            <span className="text-[10px] mt-auto text-right font-normal">{task.hoursPerDay}h</span>
                            
                            {/* Left Resize handle */}
                            {segment.isFirst && (
                              <div 
                                onMouseDown={(e) => handleResizeStart(e, task, 'left')}
                                className="absolute top-0 left-0 bottom-0 w-1.5 cursor-ew-resize bg-transparent hover:bg-black/10 opacity-0 group-hover/task:opacity-100 transition-opacity z-20"
                              />
                            )}

                            {/* Right Resize handle */}
                            {segment.isLast && (
                              <div 
                                onMouseDown={(e) => handleResizeStart(e, task, 'right')}
                                className="absolute top-0 right-0 bottom-0 w-1.5 cursor-ew-resize bg-transparent hover:bg-black/10 opacity-0 group-hover/task:opacity-100 transition-opacity z-20"
                              />
                            )}

                            {/* Bottom Resize handle */}
                            <div 
                              onMouseDown={(e) => handleResizeStart(e, task, 'bottom')}
                              className="absolute bottom-0 left-1.5 right-1.5 h-2 cursor-ns-resize bg-transparent hover:bg-black/5 flex items-center justify-center opacity-0 group-hover/task:opacity-100 transition-opacity z-20"
                            >
                              <div className="w-4 h-0.5 bg-black/20 rounded-full"></div>
                            </div>
                          </div>
                        ))}
                      </React.Fragment>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
          {/* Today line */}
          <div 
            className="absolute top-0 bottom-0 w-px bg-red-500 z-20 pointer-events-none"
            style={{ left: getDayPosition(new Date(), timelineDates, pixelsPerDay) + 256 }}
          >
          </div>

          {/* Context Menu */}
          <AnimatePresence>
            {contextMenu && (
              <>
                <div className="fixed inset-0 z-[90]" onClick={() => setContextMenu(null)} onContextMenu={(e) => { e.preventDefault(); setContextMenu(null); }}></div>
                <motion.div 
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="fixed z-[100] bg-white border border-border-light rounded-md shadow-xl py-1 w-36 overflow-hidden"
                  style={{ left: contextMenu.x, top: contextMenu.y }}
                >
                  <button 
                    onClick={() => {
                      handleTaskSplit(contextMenu.task, contextMenu.date);
                      setContextMenu(null);
                    }}
                    className="w-full text-left px-4 py-2 text-sm hover:bg-slate-50 flex items-center gap-2 text-slate-700"
                  >
                    <span className="material-icons-outlined text-lg text-slate-400">call_split</span>
                    <span className="font-medium">Split</span>
                  </button>
                  <button 
                    onClick={() => {
                      onDeleteTask(contextMenu.task.id);
                      setContextMenu(null);
                    }}
                    className="w-full text-left px-4 py-2 text-sm hover:bg-red-50 flex items-center gap-2 text-red-600"
                  >
                    <span className="material-icons-outlined text-lg">delete</span>
                    <span className="font-medium">Delete</span>
                  </button>
                </motion.div>
              </>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
};

// --- Modals ---

const StaffModal = ({ isOpen, onClose, onSave, initialData }: { isOpen: boolean, onClose: () => void, onSave: (s: Partial<Staff>) => void, initialData?: Staff | null }) => {
  const [name, setName] = useState('');
  const [role, setRole] = useState('');
  const [department, setDepartment] = useState('Product Design');
  const [location, setLocation] = useState('');

  useEffect(() => {
    if (isOpen) {
      if (initialData) {
        setName(initialData.name);
        setRole(initialData.role);
        setDepartment(initialData.department);
        setLocation(initialData.location);
      } else {
        setName('');
        setRole('');
        setDepartment('Product Design');
        setLocation('');
      }
    }
  }, [isOpen, initialData]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !role) return;
    
    onSave({
      id: initialData?.id,
      name,
      role,
      department,
      location,
      weeklyAllocation: initialData?.weeklyAllocation || 0,
      maxHours: initialData?.maxHours || 40,
      initials: name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white rounded-xl shadow-2xl w-[480px] max-w-[90vw] overflow-hidden border border-slate-200"
      >
        <form onSubmit={handleSubmit}>
          <div className="px-6 py-4 border-b border-slate-200 flex justify-between items-center">
            <h2 className="text-lg font-bold">{initialData ? 'Edit Team Member' : 'Add Team Member'}</h2>
            <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={20} /></button>
          </div>
          <div className="p-6 space-y-4">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-500">Full Name</label>
              <input 
                className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-primary focus:border-primary outline-none" 
                placeholder="e.g. John Doe" 
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-500">Role</label>
              <input 
                className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-primary focus:border-primary outline-none" 
                placeholder="e.g. UI Designer" 
                value={role}
                onChange={(e) => setRole(e.target.value)}
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-500">Department</label>
                <select 
                  className="w-full px-3 py-2 border border-slate-300 rounded-md outline-none"
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                >
                  <option>Product Design</option>
                  <option>Interactive Media</option>
                  <option>Landscape Arch</option>
                  <option>Architecture</option>
                  <option>Engineering</option>
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-500">Location</label>
                <input 
                  className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-primary focus:border-primary outline-none" 
                  placeholder="e.g. London" 
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                />
              </div>
            </div>
          </div>
          <div className="px-6 py-4 bg-slate-50 flex justify-end gap-3">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-bold text-slate-600 hover:bg-slate-200 rounded-lg">Cancel</button>
            <button type="submit" className="px-6 py-2 text-sm font-bold bg-primary text-white rounded-lg">{initialData ? 'Save Changes' : 'Add Member'}</button>
          </div>
        </form>
      </motion.div>
    </div>
  );
};

const TaskModal = ({ 
  isOpen, 
  onClose, 
  task, 
  projects, 
  staff, 
  onDelete,
  onUpdate
}: { 
  isOpen: boolean, 
  onClose: () => void, 
  task: Task | null, 
  projects: Project[], 
  staff: Staff[], 
  onDelete: (id: string) => void,
  onUpdate: (taskId: string, updates: Partial<Task>) => void
}) => {
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [hoursPerDay, setHoursPerDay] = useState(8);
  const [description, setDescription] = useState('');

  useEffect(() => {
    if (task) {
      setStartDate(task.startDate);
      setEndDate(task.endDate);
      setHoursPerDay(task.hoursPerDay);
      setDescription(task.description || "Initial planning phase covering site analysis and preliminary zoning concepts.");
    }
  }, [task]);

  if (!isOpen || !task) return null;
  const project = projects.find(p => p.id === task.projectId);
  const assignedStaff = staff.find(s => s.id === task.staffId);

  const handleSave = () => {
    onUpdate(task.id, {
      startDate,
      endDate,
      hoursPerDay,
      description
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white rounded-xl shadow-2xl w-[480px] max-w-[90vw] overflow-hidden border border-slate-200"
      >
        <div className="px-6 pt-6 pb-4 border-b border-slate-200 flex justify-between items-start">
          <div className="flex-1 pr-4">
            <div className="flex items-center gap-2 mb-2">
              <span className="px-2 py-0.5 text-xs font-semibold rounded bg-blue-100 text-blue-700">
                {task.status}
              </span>
              <span className="text-xs text-slate-400">ID: #{task.id}</span>
            </div>
            <h2 className="text-lg font-bold leading-tight">{task.title}</h2>
            <p className="text-sm text-slate-500 mt-1">{project?.name} Project</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={20} /></button>
        </div>
        <div className="p-6 space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1.5">Start Date</label>
              <div className="flex items-center text-sm text-slate-900 bg-white px-3 py-2 rounded border border-slate-200 focus-within:ring-2 focus-within:ring-primary/20 focus-within:border-primary transition-all">
                <Calendar size={16} className="mr-2 text-slate-400" />
                <input 
                  type="date" 
                  value={startDate} 
                  onChange={(e) => setStartDate(e.target.value)}
                  className="bg-transparent border-none outline-none w-full"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1.5">End Date</label>
              <div className="flex items-center text-sm text-slate-900 bg-white px-3 py-2 rounded border border-slate-200 focus-within:ring-2 focus-within:ring-primary/20 focus-within:border-primary transition-all">
                <Calendar size={16} className="mr-2 text-slate-400" />
                <input 
                  type="date" 
                  value={endDate} 
                  onChange={(e) => setEndDate(e.target.value)}
                  className="bg-transparent border-none outline-none w-full"
                />
              </div>
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1.5">Description</label>
            <textarea 
              className="w-full text-sm bg-white border border-slate-200 rounded-lg p-3 focus:ring-2 focus:ring-primary focus:border-primary outline-none min-h-[80px]" 
              placeholder="Add a description..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-medium text-slate-500">Assigned Team</label>
              <button className="text-xs text-primary hover:text-primary/80 font-medium flex items-center">
                <Plus size={14} className="mr-1" /> Add Person
              </button>
            </div>
            <div className="flex items-center justify-between p-2 rounded-lg bg-slate-50 border border-slate-200">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center font-bold text-xs">
                  {assignedStaff?.initials}
                </div>
                <div>
                  <p className="text-sm font-medium">{assignedStaff?.name}</p>
                  <p className="text-xs text-slate-500">{assignedStaff?.role}</p>
                </div>
              </div>
              <div className="text-right">
                <div className="flex items-center gap-1">
                  <input 
                    type="number" 
                    value={hoursPerDay} 
                    onChange={(e) => setHoursPerDay(Number(e.target.value))}
                    className="w-12 text-sm font-semibold bg-white border border-slate-200 rounded px-1 py-0.5 text-right outline-none focus:ring-1 focus:ring-primary"
                  />
                  <span className="text-sm font-semibold">h</span>
                </div>
                <span className="block text-[10px] text-slate-400">/ day</span>
              </div>
            </div>
          </div>
        </div>
        <div className="px-6 py-4 bg-slate-50 flex justify-between items-center border-t border-slate-200">
          <button 
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onDelete(task.id);
              onClose();
            }}
            className="px-4 py-2 text-sm font-medium text-red-600 bg-white border border-red-200 rounded-lg hover:bg-red-50 transition-colors"
          >
            Delete
          </button>
          <div className="flex gap-3">
            <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50">Cancel</button>
            <button onClick={handleSave} className="px-4 py-2 text-sm font-medium text-white bg-primary hover:bg-primary/90 rounded-lg shadow-sm">Save Changes</button>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

const ProjectPlanView = ({ 
  projects, 
  staff, 
  tasks, 
  onAddTask,
  onAddTaskImmediate,
  onUpdateTask,
  onDeleteTask,
  onTaskClick,
  timelineDates,
  timelineStartDate,
  scrollLeft,
  onScroll,
  pixelsPerDay,
  zoomLevel,
  onZoomChange,
  dailyAllocations,
  onAddPerson,
  onAddProject,
  selectedDepartment,
  onDepartmentChange
}: { 
  projects: Project[], 
  staff: Staff[], 
  tasks: Task[], 
  onAddTask: (initials?: Partial<Task>) => void,
  onAddTaskImmediate: (task: Partial<Task>) => void,
  onUpdateTask: (taskId: string, updates: Partial<Task>) => void,
  onDeleteTask: (taskId: string) => void,
  onTaskClick?: (t: Task) => void,
  timelineDates: Date[],
  timelineStartDate: Date,
  scrollLeft: number,
  onScroll: (s: number) => void,
  pixelsPerDay: number,
  zoomLevel: 'days' | 'weeks' | 'months',
  onZoomChange: (z: 'days' | 'weeks' | 'months') => void,
  dailyAllocations: Record<string, Record<string, number>>,
  onAddPerson: () => void,
  onAddProject: () => void,
  selectedDepartment: string,
  onDepartmentChange: (d: string) => void
}) => {
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const [isZoomDropdownOpen, setIsZoomDropdownOpen] = React.useState(false);
  const [isAddDropdownOpen, setIsAddDropdownOpen] = React.useState(false);
  const dragHandlers = useDragScroll(scrollRef);
  const [resizingTask, setResizingTask] = React.useState<{ id: string, startY: number, startHours: number } | null>(null);
  const [draggingTask, setDraggingTask] = React.useState<{
    id: string,
    startX: number,
    initialStartDate: string,
    initialEndDate: string
  } | null>(null);
  const hasMovedRef = React.useRef(false);
  const [contextMenu, setContextMenu] = React.useState<{
    x: number,
    y: number,
    task: Task,
    date: string
  } | null>(null);

  const { rowHeights, taskPositions } = React.useMemo(() => {
    const heights: Record<string, number> = {};
    const positions: Record<string, { top: number, height: number }> = {};
    
    projects.forEach(project => {
      staff.forEach(person => {
        const personTasks = tasks.filter(t => t.staffId === person.id && t.projectId === project.id);
        if (personTasks.length > 0) {
          const key = `${project.id}-${person.id}`;
          const { positions: personPositions, maxBottom } = getTaskPositions(personTasks, 6, 8, 4);
          
          Object.assign(positions, personPositions);
          heights[key] = Math.max(64, maxBottom + 16); // 64 is h-16, 16 for padding
        }
      });
    });
    
    return { rowHeights: heights, taskPositions: positions };
  }, [projects, staff, tasks]);

  const handleResizeStart = (e: React.MouseEvent, task: Task) => {
    e.preventDefault();
    e.stopPropagation();
    hasMovedRef.current = false;
    setResizingTask({ id: task.id, startY: e.pageY, startHours: task.hoursPerDay });
  };

  const handleDragStart = (e: React.MouseEvent, task: Task) => {
    e.preventDefault();
    e.stopPropagation();
    hasMovedRef.current = false;
    setDraggingTask({
      id: task.id,
      startX: e.pageX,
      initialStartDate: task.startDate,
      initialEndDate: task.endDate
    });
  };

  const handleTaskSplit = (task: Task, splitDate: string) => {
    if (splitDate <= task.startDate || splitDate > task.endDate) return;
    const preEnd = getPreviousDay(splitDate, timelineDates);
    onUpdateTask(task.id, { endDate: preEnd });
    onAddTaskImmediate({
      ...task,
      id: undefined,
      startDate: splitDate,
      endDate: task.endDate,
      title: task.title
    });
  };

  React.useEffect(() => {
    const handleGlobalMouseMove = (e: MouseEvent) => {
      if (resizingTask) {
        hasMovedRef.current = true;
        const deltaY = e.pageY - resizingTask.startY;
        const deltaHours = deltaY / 6; // Scale for ProjectPlanView
        const newHours = Math.max(0.5, Math.min(24, resizingTask.startHours + deltaHours));
        onUpdateTask(resizingTask.id, { hoursPerDay: Math.round(newHours * 2) / 2 });
      } else if (draggingTask) {
        if (!scrollRef.current) return;
        hasMovedRef.current = true;
        const rect = scrollRef.current.getBoundingClientRect();
        const deltaX = e.pageX - draggingTask.startX;
        const daysMoved = Math.round(deltaX / pixelsPerDay);
        
        if (daysMoved !== 0) {
          const startIndex = timelineDates.findIndex(d => formatDate(d) === draggingTask.initialStartDate);
          const endIndex = timelineDates.findIndex(d => formatDate(d) === draggingTask.initialEndDate);
          
          if (startIndex !== -1 && endIndex !== -1) {
            const newStartIndex = Math.max(0, Math.min(timelineDates.length - 1, startIndex + daysMoved));
            const newEndIndex = Math.max(0, Math.min(timelineDates.length - 1, endIndex + daysMoved));
            
            const newStartDate = formatDate(timelineDates[newStartIndex]);
            const newEndDate = formatDate(timelineDates[newEndIndex]);
            
            onUpdateTask(draggingTask.id, { startDate: newStartDate, endDate: newEndDate });
          }
        }
      }
    };

    const handleGlobalMouseUp = () => {
      setResizingTask(null);
      setDraggingTask(null);
    };

    if (resizingTask || draggingTask) {
      window.addEventListener('mousemove', handleGlobalMouseMove);
      window.addEventListener('mouseup', handleGlobalMouseUp);
    }

    return () => {
      window.removeEventListener('mousemove', handleGlobalMouseMove);
      window.removeEventListener('mouseup', handleGlobalMouseUp);
    };
  }, [resizingTask, draggingTask, onUpdateTask, timelineDates, pixelsPerDay]);

  React.useEffect(() => {
    if (scrollRef.current) {
      if (scrollLeft === 0) {
        const today = new Date();
        const day = today.getDay();
        const monday = new Date(today);
        monday.setDate(today.getDate() - (day === 0 ? 6 : day - 1));
        const prevMonday = new Date(monday);
        prevMonday.setDate(monday.getDate() - 7);
        
        const startPos = getDayPosition(formatDate(prevMonday), timelineDates, pixelsPerDay);
        const scrollPos = Math.max(0, startPos);
        scrollRef.current.scrollLeft = scrollPos;
        onScroll(scrollPos);
      } else {
        scrollRef.current.scrollLeft = scrollLeft;
      }
    }
  }, []);

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    onScroll(e.currentTarget.scrollLeft);
  };

  const scrollToToday = () => {
    if (scrollRef.current) {
      const today = new Date();
      const day = today.getDay();
      const monday = new Date(today);
      // Normalize today to midnight
      today.setHours(0,0,0,0);
      monday.setHours(0,0,0,0);
      monday.setDate(today.getDate() - (day === 0 ? 6 : day - 1));
      const prevMonday = new Date(monday);
      prevMonday.setDate(monday.getDate() - 7);
      
      const scrollPos = getDayPosition(formatDate(prevMonday), timelineDates, pixelsPerDay);
      scrollRef.current.scrollTo({ left: scrollPos, behavior: 'smooth' });
    }
  };

  const scrollBy = (amount: number) => {
    if (scrollRef.current) {
      scrollRef.current.scrollBy({ left: amount * pixelsPerDay, behavior: 'smooth' });
    }
  };

  // Group dates by week for the header
  const weeks: { weekNumber: number, monthLabel: string, days: Date[] }[] = [];
  let currentWeek: Date[] = [];
  
  timelineDates.forEach((date, i) => {
    currentWeek.push(date);
    // Group by Friday or end of timeline
    if (date.getDay() === 5 || i === timelineDates.length - 1) {
      const start = currentWeek[0];
      const end = currentWeek[currentWeek.length - 1];
      const startMonth = start.toLocaleString('default', { month: 'short' });
      const endMonth = end.toLocaleString('default', { month: 'short' });
      const monthLabel = startMonth === endMonth ? startMonth : `${startMonth} - ${endMonth}`;
      weeks.push({
        weekNumber: getWeekNumber(start),
        monthLabel,
        days: currentWeek
      });
      currentWeek = [];
    }
  });
  
  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <header className="bg-surface-light border-b border-border-light p-4 flex items-center justify-between shrink-0 shadow-sm z-50 relative">
        <div className="flex items-center space-x-4">
          <h1 className="text-xl font-semibold text-text-main-light">Project Plan</h1>
          <div className="h-6 w-px bg-border-light mx-2"></div>
          <div className="relative flex items-center">
            <span className="material-icons-outlined text-lg absolute left-2 text-slate-400 pointer-events-none">category</span>
            <select 
              value={selectedDepartment}
              onChange={(e) => onDepartmentChange(e.target.value)}
              className="pl-9 pr-8 py-1.5 border border-border-light rounded bg-white text-sm font-medium outline-none appearance-none hover:bg-slate-50 transition-colors cursor-pointer"
            >
              <option>All Departments</option>
              <option>Product Design</option>
              <option>Interactive Media</option>
              <option>Landscape Arch</option>
              <option>Architecture</option>
              <option>Engineering</option>
            </select>
            <span className="material-icons-outlined text-sm absolute right-2 text-slate-400 pointer-events-none">expand_more</span>
          </div>
          <button className="flex items-center space-x-1 px-3 py-1.5 border border-border-light rounded hover:bg-slate-50 text-sm font-medium transition-colors">
            <span className="material-icons-outlined text-lg">filter_list</span>
            <span>All Filters</span>
          </button>
          <div className="flex items-center border border-border-light rounded overflow-hidden">
            <button 
              onClick={() => scrollBy(-5)}
              className="px-3 py-1.5 hover:bg-slate-50 border-r border-border-light text-text-muted-light"
            >
              <span className="material-icons-outlined text-lg">chevron_left</span>
            </button>
            <button 
              onClick={scrollToToday}
              className="px-4 py-1.5 text-sm font-medium hover:bg-slate-50"
            >
              This week
            </button>
            <button 
              onClick={() => scrollBy(5)}
              className="px-3 py-1.5 hover:bg-slate-50 border-l border-border-light text-text-muted-light"
            >
              <span className="material-icons-outlined text-lg">chevron_right</span>
            </button>
          </div>
        </div>
        <div className="flex items-center space-x-3">
          <span className="text-xs font-semibold text-text-muted-light bg-slate-100 px-2 py-1 rounded">Active Projects</span>
          <div className="h-6 w-px bg-border-light mx-2"></div>
          <button 
            onClick={scrollToToday}
            className="px-3 py-1.5 border border-border-light rounded hover:bg-slate-50 text-sm font-medium"
          >
            Today
          </button>
          <button 
            onClick={onAddPerson}
            className="flex items-center space-x-1 px-3 py-1.5 border border-border-light rounded hover:bg-slate-50 text-sm font-medium transition-colors"
          >
            <span className="material-icons-outlined text-lg">person_add</span>
            <span>Add People</span>
          </button>
          <div className="relative">
            <button 
              onClick={() => setIsZoomDropdownOpen(!isZoomDropdownOpen)}
              className="flex items-center space-x-1 px-3 py-1.5 border border-border-light rounded hover:bg-slate-50 text-sm font-medium capitalize"
            >
              <span>{zoomLevel}</span>
              <span className="material-icons-outlined text-sm">expand_more</span>
            </button>
            <AnimatePresence>
              {isZoomDropdownOpen && (
                <motion.div 
                  key="dropdown"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 10 }}
                  className="absolute right-0 mt-1 w-32 bg-white border border-border-light rounded-md shadow-lg z-50 overflow-hidden"
                >
                  {(['days', 'weeks', 'months'] as const).map((z) => (
                    <button
                      key={z}
                      onClick={() => {
                        onZoomChange(z);
                        setIsZoomDropdownOpen(false);
                      }}
                      className={`w-full text-left px-4 py-2 text-sm hover:bg-slate-50 capitalize ${zoomLevel === z ? 'text-primary font-bold' : 'text-text-main-light'}`}
                    >
                      {z}
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
            {isZoomDropdownOpen && (
              <div className="fixed inset-0 z-40" onClick={() => setIsZoomDropdownOpen(false)}></div>
            )}
          </div>
          <div className="h-6 w-px bg-border-light mx-2"></div>
          <button className="p-1.5 text-text-muted-light hover:bg-slate-100 rounded transition-colors">
            <span className="material-icons-outlined">search</span>
          </button>
          <button className="p-1.5 text-text-muted-light hover:bg-slate-100 rounded transition-colors">
            <span className="material-icons-outlined">open_in_new</span>
          </button>
          <div className="relative">
            <button 
              onClick={() => setIsAddDropdownOpen(!isAddDropdownOpen)}
              className="w-8 h-8 bg-primary hover:bg-primary-dark text-white rounded flex items-center justify-center shadow-md transition-colors"
            >
              <span className="material-icons-outlined">add</span>
            </button>
            <AnimatePresence>
              {isAddDropdownOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setIsAddDropdownOpen(false)}></div>
                  <motion.div 
                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 10, scale: 0.95 }}
                    className="absolute right-0 mt-2 w-56 bg-white border border-border-light rounded-xl shadow-xl z-50 overflow-hidden py-1"
                  >
                    <button 
                      onClick={() => { onAddTask(); setIsAddDropdownOpen(false); }}
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
                    >
                      <span className="material-icons-outlined text-lg text-slate-400">event_available</span>
                      <span className="font-medium">Add Allocation</span>
                    </button>
                    <button 
                      onClick={() => { onAddProject(); setIsAddDropdownOpen(false); }}
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
                    >
                      <span className="material-icons-outlined text-lg text-slate-400">create_new_folder</span>
                      <span className="font-medium">Add Project</span>
                    </button>
                    <button 
                      onClick={() => { onAddPerson(); setIsAddDropdownOpen(false); }}
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
                    >
                      <span className="material-icons-outlined text-lg text-slate-400">person_add</span>
                      <span className="font-medium">Add People</span>
                    </button>
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          </div>
        </div>
      </header>

      <div 
        ref={scrollRef}
        onScroll={handleScroll}
        {...dragHandlers}
        className="flex-1 overflow-auto timeline-scroll bg-surface-light relative"
      >
        <div className="relative" style={{ width: timelineDates.length * pixelsPerDay + 256 }}>
          <div className="flex sticky-header bg-white z-40 shadow-sm border-b border-border-light">
            <div className="sticky-col w-64 min-w-[16rem] bg-white border-r border-border-light sticky-corner z-50 flex items-center px-4 py-2 justify-between">
              <span className="text-xs text-text-muted-light font-medium">Project Plan</span>
            </div>
            <div className="flex flex-1">
              {weeks.map((week, idx) => (
                <div key={idx} className="flex flex-col border-r border-border-light" style={{ width: week.days.length * pixelsPerDay }}>
                  <div className="h-6 flex items-center px-2 text-xs font-semibold text-text-muted-light border-b border-border-light bg-slate-50 relative">
                    <span className="absolute left-2">{week.weekNumber}</span>
                    <span className="w-full text-center">{week.monthLabel}</span>
                  </div>
                  <div className="h-10 flex">
                    {week.days.map((day, dIdx) => {
                      const isToday = formatDate(day) === formatDate(new Date());
                      const isFriday = day.getDay() === 5;
                      const isHoliday = OBSERVED_HOLIDAYS.has(formatDate(day));
                      return (
                        <div 
                          key={dIdx} 
                          className={`border-r ${isFriday ? 'border-r-2 border-slate-300' : 'border-border-light'} flex flex-col justify-center items-center text-[10px] shrink-0 text-text-muted-light ${isToday ? 'bg-blue-50/30 border-t-2 border-t-primary' : ''} ${isHoliday ? 'holiday-hatch' : ''}`}
                          style={{ width: pixelsPerDay }}
                        >
                          <span className={`${isToday ? 'text-primary font-bold' : ''}`}>{['S','M','T','W','T','F','S'][day.getDay()]}</span>
                          <span className={`flex items-center justify-center w-6 h-6 rounded-full mt-0.5 ${isToday ? 'bg-primary text-white font-bold' : 'text-text-main-light'}`}>
                            {day.getDate()}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex flex-col">
            {projects.map(project => (
              <React.Fragment key={project.id}>
                <div className="flex h-8 bg-slate-50/50 hover:bg-slate-100/50 transition-colors border-b border-slate-100">
                  <div className="sticky-col w-64 min-w-[16rem] bg-slate-50 border-r border-slate-200 px-3 flex items-center justify-between">
                    <div className="flex items-center space-x-2 overflow-hidden">
                      <ChevronRight size={14} className="text-slate-400" />
                      <div className="w-2 h-2 rounded-full" style={{ backgroundColor: project.color }}></div>
                      <span className="text-xs font-semibold truncate">{project.code} - {project.name}</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Users size={14} className="text-slate-400" />
                      <span className="text-[10px] text-slate-400">{project.teamSize}</span>
                    </div>
                  </div>
                  <div className="flex-1 relative py-1 px-0">
                    {(() => {
                      const left = getDayPosition(project.startDate, timelineDates, pixelsPerDay);
                      const width = getTaskWidth(project.startDate, project.endDate, timelineDates, pixelsPerDay);
                      if (left === -1 || width === 0) return null;
                      return (
                        <div 
                          className="absolute top-1.5 h-5 rounded-sm shadow-sm flex items-center px-2 overflow-hidden text-white text-[10px] font-normal"
                          style={{ 
                            backgroundColor: project.color,
                            left,
                            width
                          }}
                        >
                          {project.name}
                        </div>
                      );
                    })()}
                  </div>
                </div>
                {/* Staff sub-rows */}
                {staff.filter(s => tasks.some(t => t.staffId === s.id && t.projectId === project.id)).map(person => (
                  <div key={`${project.id}-${person.id}`} className="flex bg-white hover:bg-slate-50 transition-colors border-b border-slate-100" style={{ height: rowHeights[`${project.id}-${person.id}`] }}>
                    <div className="sticky-col w-64 min-w-[16rem] bg-white border-r border-slate-200 px-3 pl-8 flex items-center space-x-3">
                      <div className="w-7 h-7 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center font-bold text-[10px]">
                        {person.initials}
                      </div>
                      <div className="flex flex-col min-w-0">
                        <h3 className="font-medium text-[11px] truncate">{person.name}</h3>
                        <p className="text-[9px] text-slate-400">{person.role}</p>
                      </div>
                    </div>
                    <div 
                      className="flex-1 relative py-2 px-0 cursor-crosshair"
                      onClick={(e) => {
                        const rect = e.currentTarget.getBoundingClientRect();
                        const x = e.clientX - rect.left;
                        const date = getDateAtX(x, timelineDates, pixelsPerDay);
                        if (date && !OBSERVED_HOLIDAYS.has(date)) {
                          onAddTask({ staffId: person.id, projectId: project.id, startDate: date, endDate: date, title: 'New Allocation' });
                        }
                      }}
                      style={{
                        backgroundImage: `
                          linear-gradient(to right, transparent ${pixelsPerDay - 1}px, rgba(226, 232, 240, 0.8) ${pixelsPerDay - 1}px),
                          linear-gradient(to right, transparent ${pixelsPerDay * 5 - 2}px, rgba(203, 213, 225, 0.9) ${pixelsPerDay * 5 - 2}px)
                        `,
                        backgroundSize: `${pixelsPerDay}px 100%, ${pixelsPerDay * 5}px 100%`,
                        backgroundPosition: `0 0, -${(timelineDates[0].getDay() - 1) * pixelsPerDay}px 0`
                      }}
                    >
                      {/* Over-allocation and holiday background layer */}
                      <div className="absolute inset-0 pointer-events-none flex">
                        {timelineDates.map((date, i) => {
                          const dStr = formatDate(date);
                          const isHoliday = OBSERVED_HOLIDAYS.has(dStr);
                          const totalHours = dailyAllocations[person.id]?.[dStr] || 0;
                          
                          return (
                            <React.Fragment key={i}>
                              {isHoliday && (
                                <div 
                                  key={`holiday-${i}`} 
                                  className="absolute top-0 bottom-0 holiday-hatch z-0"
                                  style={{ left: i * pixelsPerDay, width: pixelsPerDay }}
                                />
                              )}
                              {totalHours > 8 && (
                                <div 
                                  key={`over-${i}`}
                                  className="absolute top-0 bottom-0 bg-red-500/20 border-x border-red-500/30 z-0" 
                                  style={{ left: i * pixelsPerDay, width: pixelsPerDay }}
                                />
                              )}
                            </React.Fragment>
                          );
                        })}
                      </div>

                      {tasks.filter(t => t.staffId === person.id && t.projectId === project.id).map(task => {
                        const segments = getTaskSegments(task.startDate, task.endDate, timelineDates, pixelsPerDay);
                        if (segments.length === 0) return null;
                        
                        const isResizing = resizingTask?.id === task.id;
                        const pos = taskPositions[task.id] || { top: (64 - (task.hoursPerDay * 6)) / 2, height: task.hoursPerDay * 6 };
                        
                        return (
                          <React.Fragment key={task.id}>
                            {segments.map((segment, idx) => (
                              <div 
                                key={`${task.id}-${idx}`}
                                onMouseDown={(e) => handleDragStart(e, task)}
                                onContextMenu={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  const rect = scrollRef.current?.getBoundingClientRect();
                                  if (!rect) return;
                                  const xInTimeline = e.pageX - rect.left + scrollRef.current!.scrollLeft - 256;
                                  const dateAtX = getDateAtX(xInTimeline, timelineDates, pixelsPerDay);
                                  if (dateAtX) {
                                    setContextMenu({ x: e.pageX, y: e.pageY, task, date: dateAtX });
                                  }
                                }}
                                onClick={(e) => { 
                                  e.stopPropagation(); 
                                  if (hasMovedRef.current) {
                                    hasMovedRef.current = false;
                                    return;
                                  }
                                  onTaskClick && onTaskClick(task); 
                                }}
                                className={`absolute rounded shadow-sm flex flex-col p-1 overflow-hidden text-white group/task cursor-grab active:cursor-grabbing ${isResizing ? 'ring-2 ring-white z-20' : ''} ${draggingTask?.id === task.id ? 'opacity-50 z-30' : ''}`}
                                style={{ 
                                  left: segment.left,
                                  width: segment.width,
                                  height: `${pos.height}px`,
                                  top: `${pos.top}px`,
                                  backgroundColor: project.color
                                }}
                              >
                                <span className="text-[9px] font-normal truncate leading-tight">{task.title}</span>
                                <span className="text-[8px] mt-auto text-right opacity-80 font-normal">{task.hoursPerDay}h</span>
                                
                                {/* Resize handle */}
                                <div 
                                  onMouseDown={(e) => handleResizeStart(e, task)}
                                  className="absolute bottom-0 left-0 right-0 h-1.5 cursor-ns-resize bg-transparent hover:bg-white/20 flex items-center justify-center opacity-0 group-hover/task:opacity-100 transition-opacity"
                                >
                                  <div className="w-4 h-0.5 bg-white/50 rounded-full"></div>
                                </div>
                              </div>
                            ))}
                          </React.Fragment>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </React.Fragment>
            ))}
          </div>
          {/* Today line */}
          <div 
            className="absolute top-0 bottom-0 w-px bg-red-500 z-20 pointer-events-none"
            style={{ left: getDayPosition(new Date(), timelineDates, pixelsPerDay) + 256 }}
          >
          </div>

          {/* Context Menu */}
          <AnimatePresence>
            {contextMenu && (
              <>
                <div className="fixed inset-0 z-[90]" onClick={() => setContextMenu(null)} onContextMenu={(e) => { e.preventDefault(); setContextMenu(null); }}></div>
                <motion.div 
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="fixed z-[100] bg-white border border-border-light rounded-md shadow-xl py-1 w-36 overflow-hidden"
                  style={{ left: contextMenu.x, top: contextMenu.y }}
                >
                  <button 
                    onClick={() => {
                      handleTaskSplit(contextMenu.task, contextMenu.date);
                      setContextMenu(null);
                    }}
                    className="w-full text-left px-4 py-2 text-sm hover:bg-slate-50 flex items-center gap-2 text-slate-700"
                  >
                    <span className="material-icons-outlined text-lg text-slate-400">call_split</span>
                    <span className="font-medium">Split</span>
                  </button>
                  <button 
                    onClick={() => {
                      onDeleteTask(contextMenu.task.id);
                      setContextMenu(null);
                    }}
                    className="w-full text-left px-4 py-2 text-sm hover:bg-red-50 flex items-center gap-2 text-red-600"
                  >
                    <span className="material-icons-outlined text-lg">delete</span>
                    <span className="font-medium">Delete</span>
                  </button>
                </motion.div>
              </>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
};

const CreateTaskModal = ({ 
  isOpen, 
  onClose, 
  onAdd, 
  projects, 
  staff,
  initialValues
}: { 
  isOpen: boolean, 
  onClose: () => void, 
  onAdd: (t: Partial<Task>) => void, 
  projects: Project[], 
  staff: Staff[],
  initialValues?: Partial<Task>
}) => {
  if (!isOpen) return null;
  
  const [activeTab, setActiveTab] = useState<'Allocation' | 'Time off' | 'Status'>(
    (initialValues?.type as any) || 'Allocation'
  );
  const [title, setTitle] = useState(initialValues?.title || '');
  const [projectId, setProjectId] = useState(initialValues?.projectId || projects[0]?.id || '');
  const [staffId, setStaffId] = useState(initialValues?.staffId || staff[0]?.id || '');
  const [startDate, setStartDate] = useState(initialValues?.startDate || formatDate(new Date()));
  const [endDate, setEndDate] = useState(initialValues?.endDate || formatDate(new Date()));
  const [hoursPerDay, setHoursPerDay] = useState(initialValues?.hoursPerDay || 8);
  const [timeOffType, setTimeOffType] = useState<'Medical Leave' | 'Annual Leave' | 'Unpaid Leave'>(
    initialValues?.timeOffType || 'Annual Leave'
  );

  // Update state when initialValues change
  React.useEffect(() => {
    if (initialValues) {
      if (initialValues.title !== undefined) setTitle(initialValues.title);
      if (initialValues.projectId !== undefined) setProjectId(initialValues.projectId);
      if (initialValues.staffId !== undefined) setStaffId(initialValues.staffId);
      if (initialValues.startDate !== undefined) setStartDate(initialValues.startDate);
      if (initialValues.endDate !== undefined) setEndDate(initialValues.endDate);
      if (initialValues.hoursPerDay !== undefined) setHoursPerDay(initialValues.hoursPerDay);
      if (initialValues.type !== undefined) setActiveTab(initialValues.type as any);
      if (initialValues.timeOffType !== undefined) setTimeOffType(initialValues.timeOffType);
    }
  }, [initialValues]);

  const handleSubmit = () => {
    onAdd({
      title: activeTab === 'Time off' ? timeOffType : title,
      projectId: activeTab === 'Time off' ? 'time-off' : projectId,
      staffId,
      startDate,
      endDate,
      hoursPerDay,
      type: activeTab,
      timeOffType: activeTab === 'Time off' ? timeOffType : undefined,
      status: 'Pending'
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white rounded-xl shadow-2xl w-[480px] max-w-[90vw] overflow-hidden border border-slate-200"
      >
        <div className="px-6 py-4 border-b border-slate-200 flex justify-between items-center">
          <h2 className="text-lg font-bold">
            {activeTab === 'Allocation' ? 'Assign Task' : activeTab === 'Time off' ? 'Add Time off' : 'Status Update'}
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={20} /></button>
        </div>

        {/* Tabs */}
        <div className="flex bg-slate-100 p-1 mx-6 mt-4 rounded-lg">
          {(['Allocation', 'Time off', 'Status'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 py-1.5 text-xs font-semibold rounded-md transition-all ${
                activeTab === tab 
                  ? 'bg-white text-slate-900 shadow-sm' 
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        <div className="p-6 space-y-4">
          {activeTab === 'Allocation' && (
            <>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-500">Task Title</label>
                <input 
                  className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-primary focus:border-primary outline-none" 
                  placeholder="e.g. Concept Design"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-500">Project</label>
                <select 
                  className="w-full px-3 py-2 border border-slate-300 rounded-md outline-none"
                  value={projectId}
                  onChange={(e) => setProjectId(e.target.value)}
                >
                  {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
            </>
          )}

          {activeTab === 'Time off' && (
            <>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-500">Type of Leave</label>
                <select 
                  className="w-full px-3 py-2 border border-slate-300 rounded-md outline-none"
                  value={timeOffType}
                  onChange={(e) => setTimeOffType(e.target.value as any)}
                >
                  <option value="Medical Leave">Medical Leave</option>
                  <option value="Annual Leave">Annual Leave</option>
                  <option value="Unpaid Leave">Unpaid Leave</option>
                </select>
              </div>
            </>
          )}

          {activeTab === 'Status' && (
            <div className="py-8 text-center text-slate-400 italic text-sm">
              Status updates coming soon...
            </div>
          )}

          {(activeTab === 'Allocation' || activeTab === 'Time off') && (
            <>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-500">Assign To</label>
                <select 
                  className="w-full px-3 py-2 border border-slate-300 rounded-md outline-none"
                  value={staffId}
                  onChange={(e) => setStaffId(e.target.value)}
                >
                  {staff.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-500">Start Date</label>
                  <input 
                    type="date" 
                    className="w-full px-3 py-2 border border-slate-300 rounded-md outline-none" 
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-500">End Date</label>
                  <input 
                    type="date" 
                    className="w-full px-3 py-2 border border-slate-300 rounded-md outline-none" 
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                  />
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-500">Hours per Day</label>
                <input 
                  type="number" 
                  className="w-full px-3 py-2 border border-slate-300 rounded-md outline-none" 
                  value={hoursPerDay}
                  onChange={(e) => setHoursPerDay(Number(e.target.value))}
                />
              </div>
            </>
          )}
        </div>
        <div className="px-6 py-4 bg-slate-50 flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 text-sm font-bold text-slate-600 hover:bg-slate-200 rounded-lg">Cancel</button>
          <button onClick={handleSubmit} className="px-6 py-2 text-sm font-bold bg-primary text-white rounded-lg">
            {activeTab === 'Allocation' ? 'Assign Task' : activeTab === 'Time off' ? 'Add Time off' : 'Save'}
          </button>
        </div>
      </motion.div>
    </div>
  );
};

// --- Main App ---

export default function App() {
  const [currentView, setView] = useState<ViewType>('schedule');
  const [projects, setProjects] = useState<Project[]>(() => {
    const saved = typeof window !== 'undefined' ? localStorage.getItem('projects') : null;
    return saved ? JSON.parse(saved) : MOCK_PROJECTS;
  });
  const [staff, setStaff] = useState<Staff[]>(() => {
    const saved = typeof window !== 'undefined' ? localStorage.getItem('staff') : null;
    return saved ? JSON.parse(saved) : MOCK_STAFF;
  });
  const [tasks, setTasks] = useState<Task[]>(() => {
    const saved = typeof window !== 'undefined' ? localStorage.getItem('tasks') : null;
    return saved ? JSON.parse(saved) : MOCK_TASKS;
  });

  // Persist changes
  useEffect(() => {
    localStorage.setItem('projects', JSON.stringify(projects));
  }, [projects]);

  useEffect(() => {
    localStorage.setItem('staff', JSON.stringify(staff));
  }, [staff]);

  useEffect(() => {
    localStorage.setItem('tasks', JSON.stringify(tasks));
  }, [tasks]);
  
  const [isAddPersonModalOpen, setIsAddPersonModalOpen] = useState(false);
  const [isAddProjectModalOpen, setIsAddProjectModalOpen] = useState(false);
  const [editingStaff, setEditingStaff] = useState<Staff | null>(null);
  const [selectedDepartment, setSelectedDepartment] = useState('All Departments');
  const [isCreateTaskModalOpen, setIsCreateTaskModalOpen] = useState(false);
  const [createTaskInitialValues, setCreateTaskInitialValues] = useState<Partial<Task> | undefined>(undefined);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);

  // Timeline State
  const [zoomLevel, setZoomLevel] = useState<'days' | 'weeks' | 'months'>('months');
  const [windowWidth, setWindowWidth] = useState(typeof window !== 'undefined' ? window.innerWidth : 1200);
  
  useEffect(() => {
    const handleResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const pixelsPerDay = useMemo(() => {
    const availableWidth = windowWidth - 256; // Sidebar is 256px
    if (zoomLevel === 'days') return Math.floor(availableWidth / 7);
    if (zoomLevel === 'weeks') return Math.floor(availableWidth / 16);
    return Math.floor(availableWidth / 50);
  }, [zoomLevel, windowWidth]);

  const timelineStartDate = useMemo(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 3); // Start 3 months ago
    d.setHours(0,0,0,0);
    return d;
  }, []);
  const timelineDates = useMemo(() => getTimelineDates(timelineStartDate), [timelineStartDate]);
  const [timelineScrollLeft, setTimelineScrollLeft] = useState(0);

  const handleCreateProject = async (newProject: Partial<Project>) => {
    if (newProject.name && newProject.code) {
      const project: Project = {
        id: `project-${Date.now()}`,
        name: newProject.name,
        code: newProject.code,
        client: newProject.client || '',
        ownerId: newProject.ownerId || 'Yorke Wu',
        stage: newProject.stage || 'Confirmed',
        billable: newProject.billable ?? true,
        tags: newProject.tags || [],
        startDate: newProject.startDate || formatDate(new Date()),
        endDate: newProject.endDate || formatDate(new Date()),
        notes: newProject.notes || '',
        totalAllocation: 0,
        teamSize: 0,
        color: newProject.color || '#94a3b8'
      };
      
      setProjects(prev => [...prev, project]);
      
      // Persist to server
      try {
        await fetch('/api/projects', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(project)
        });
      } catch (error) {
        console.error('Failed to persist project to server:', error);
      }
    }
    setIsAddProjectModalOpen(false);
  };

  const handleAddPerson = async (newPerson: Partial<Staff>) => {
    if (newPerson.name && newPerson.role) {
      if (newPerson.id) {
        // Update existing
        setStaff(prev => prev.map(s => s.id === newPerson.id ? { ...s, ...newPerson } as Staff : s));
        // Note: Update API not implemented in server yet, but we'll focus on adding for now
      } else {
        // Add new
        const person: Staff = {
          id: `staff-${Date.now()}`,
          name: newPerson.name,
          role: newPerson.role,
          department: newPerson.department || 'Product Design',
          location: newPerson.location || '',
          weeklyAllocation: 0,
          maxHours: 40,
          initials: newPerson.initials || '??'
        };
        setStaff(prev => [...prev, person]);
        
        // Persist to server
        try {
          await fetch('/api/staff', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(person)
          });
        } catch (error) {
          console.error('Failed to persist staff to server:', error);
        }
      }
    }
    setIsAddPersonModalOpen(false);
    setEditingStaff(null);
  };

  const openEditPersonModal = (person: Staff) => {
    setEditingStaff(person);
    setIsAddPersonModalOpen(true);
  };

  const handleDeletePerson = async (personId: string) => {
    if (confirm('Are you sure you want to delete this team member? This will also remove their task assignments.')) {
      setStaff(prev => prev.filter(s => s.id !== personId));
      setTasks(prev => prev.filter(t => t.staffId !== personId));
      
      // Persist to server
      try {
        await fetch(`/api/staff/${personId}`, {
          method: 'DELETE'
        });
      } catch (error) {
        console.error('Failed to delete staff from server:', error);
      }
    }
  };

  const handleAddTask = async (newTask: Partial<Task>) => {
    if (newTask.title && newTask.projectId && newTask.staffId && newTask.startDate && newTask.endDate) {
      const start = newTask.startDate;
      const end = newTask.endDate;
      const staffId = newTask.staffId;

      const task: Task = {
        id: `task-${Date.now()}`,
        title: newTask.title,
        projectId: newTask.projectId,
        staffId: newTask.staffId,
        startDate: newTask.startDate,
        endDate: newTask.endDate,
        hoursPerDay: newTask.hoursPerDay || 8,
        status: 'Pending',
        type: newTask.type || 'Allocation',
        timeOffType: newTask.timeOffType
      };

      // Handle overrides
      setTasks(prev => {
        const otherStaffTasks = prev.filter(t => t.staffId !== staffId);
        const currentStaffTasks = prev.filter(t => t.staffId === staffId);
        
        const updatedStaffTasks: Task[] = [];
        
        currentStaffTasks.forEach(t => {
          // Check for overlap
          if (t.endDate < start || t.startDate > end) {
            // No overlap
            updatedStaffTasks.push(t);
          } else {
            // Overlap exists
            if (t.startDate < start && t.endDate > end) {
              // Split into two
              const preEnd = getPreviousDay(start, timelineDates);
              const postStart = getNextDay(end, timelineDates);
              if (t.startDate <= preEnd) {
                updatedStaffTasks.push({ ...t, id: `${t.id}-pre`, endDate: preEnd });
              }
              if (postStart <= t.endDate) {
                updatedStaffTasks.push({ ...t, id: `${t.id}-post`, startDate: postStart });
              }
            } else if (t.startDate < start) {
              // Truncate end
              const preEnd = getPreviousDay(start, timelineDates);
              if (t.startDate <= preEnd) {
                updatedStaffTasks.push({ ...t, endDate: preEnd });
              }
            } else if (t.endDate > end) {
              // Truncate start
              const postStart = getNextDay(end, timelineDates);
              if (postStart <= t.endDate) {
                updatedStaffTasks.push({ ...t, startDate: postStart });
              }
            }
            // If completely within, it's just not pushed (deleted)
          }
        });

        return [...otherStaffTasks, ...updatedStaffTasks, task];
      });
      
      // Persist to server (simplified: just add the new task, server doesn't know about overrides yet)
      // In a real app, we'd send the full updated state or specific delete/update commands
      try {
        await fetch('/api/tasks', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(task)
        });
      } catch (error) {
        console.error('Failed to persist task to server:', error);
      }
    }
    setIsCreateTaskModalOpen(false);
    setCreateTaskInitialValues(undefined);
  };

  const openCreateTaskModal = (initials?: Partial<Task>) => {
    setCreateTaskInitialValues(initials);
    setIsCreateTaskModalOpen(true);
  };

  const handleUpdateTask = (taskId: string, updates: Partial<Task>) => {
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, ...updates } : t));
    
    // Persist to server
    fetch(`/api/tasks/${taskId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates)
    }).catch(error => {
      console.error('Failed to update task on server:', error);
    });
  };

  const handleDeleteTask = (taskId: string) => {
    setTasks(prev => prev.filter(t => t.id !== taskId));
    
    // Persist to server
    fetch(`/api/tasks/${taskId}`, {
      method: 'DELETE'
    }).catch(error => {
      console.error('Failed to delete task from server:', error);
    });
  };

  const dailyAllocations = useMemo(() => {
    const map: Record<string, Record<string, number>> = {};
    tasks.forEach(task => {
      if (!map[task.staffId]) map[task.staffId] = {};
      
      timelineDates.forEach(date => {
        const dStr = formatDate(date);
        if (dStr >= task.startDate && dStr <= task.endDate) {
          map[task.staffId][dStr] = (map[task.staffId][dStr] || 0) + task.hoursPerDay;
        }
      });
    });
    return map;
  }, [tasks, timelineDates]);

  return (
    <div className={`flex h-screen overflow-hidden bg-background-light text-slate-900`}>
      <Sidebar currentView={currentView} setView={setView} />
      
      <main className="flex-1 flex flex-col overflow-hidden">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentView}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="flex-1 flex flex-col overflow-hidden"
          >
            {currentView === 'projects' && (
              <ProjectsView 
                projects={projects} 
                onAddProject={() => setIsAddProjectModalOpen(true)} 
              />
            )}
            {currentView === 'people' && (
              <PeopleView 
                staff={staff} 
                onAddPerson={() => setIsAddPersonModalOpen(true)}
                onEditPerson={openEditPersonModal}
                onDeletePerson={handleDeletePerson}
              />
            )}
            {currentView === 'schedule' && (
              <ScheduleView 
                staff={selectedDepartment === 'All Departments' ? staff : staff.filter(s => s.department === selectedDepartment)} 
                tasks={tasks} 
                projects={projects} 
                onTaskClick={(t) => setSelectedTask(t)}
                onAddTask={openCreateTaskModal}
                onAddTaskImmediate={handleAddTask}
                onUpdateTask={handleUpdateTask}
                onDeleteTask={handleDeleteTask}
                timelineDates={timelineDates}
                timelineStartDate={timelineStartDate}
                scrollLeft={timelineScrollLeft}
                onScroll={setTimelineScrollLeft}
                pixelsPerDay={pixelsPerDay}
                zoomLevel={zoomLevel}
                onZoomChange={setZoomLevel}
                dailyAllocations={dailyAllocations}
                onAddPerson={() => setIsAddPersonModalOpen(true)}
                onAddProject={() => setIsAddProjectModalOpen(true)}
                selectedDepartment={selectedDepartment}
                onDepartmentChange={setSelectedDepartment}
              />
            )}
            {currentView === 'project-plan' && (
              <ProjectPlanView 
                projects={projects} 
                staff={selectedDepartment === 'All Departments' ? staff : staff.filter(s => s.department === selectedDepartment)} 
                tasks={tasks} 
                onAddTask={openCreateTaskModal}
                onAddTaskImmediate={handleAddTask}
                onUpdateTask={handleUpdateTask}
                onDeleteTask={handleDeleteTask}
                onTaskClick={(t) => setSelectedTask(t)}
                timelineDates={timelineDates}
                timelineStartDate={timelineStartDate}
                scrollLeft={timelineScrollLeft}
                onScroll={setTimelineScrollLeft}
                pixelsPerDay={pixelsPerDay}
                zoomLevel={zoomLevel}
                onZoomChange={setZoomLevel}
                dailyAllocations={dailyAllocations}
                onAddPerson={() => setIsAddPersonModalOpen(true)}
                onAddProject={() => setIsAddProjectModalOpen(true)}
                selectedDepartment={selectedDepartment}
                onDepartmentChange={setSelectedDepartment}
              />
            )}
          </motion.div>
        </AnimatePresence>
      </main>

      <StaffModal 
        isOpen={isAddPersonModalOpen} 
        onClose={() => {
          setIsAddPersonModalOpen(false);
          setEditingStaff(null);
        }} 
        onSave={handleAddPerson} 
        initialData={editingStaff}
      />

      <TaskModal 
        isOpen={!!selectedTask} 
        onClose={() => setSelectedTask(null)} 
        task={selectedTask}
        projects={projects}
        staff={staff}
        onDelete={handleDeleteTask}
        onUpdate={handleUpdateTask}
      />

      <CreateTaskModal
        isOpen={isCreateTaskModalOpen}
        onClose={() => {
          setIsCreateTaskModalOpen(false);
          setCreateTaskInitialValues(undefined);
        }}
        onAdd={handleAddTask}
        projects={projects}
        staff={staff}
        initialValues={createTaskInitialValues}
      />

      <AddProjectModal 
        isOpen={isAddProjectModalOpen} 
        onClose={() => setIsAddProjectModalOpen(false)} 
        onCreate={handleCreateProject} 
      />
    </div>
  );
}
