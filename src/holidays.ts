export const BASE_HOLIDAYS = [
  // 2025
  '2025-01-01', '2025-01-29', '2025-01-30', '2025-03-31', '2025-04-18', '2025-05-01', '2025-05-03', '2025-05-12', '2025-06-07', '2025-08-09', '2025-10-20', '2025-12-25',
  // 2026
  '2026-01-01', '2026-02-17', '2026-02-18', '2026-03-21', '2026-04-03', '2026-05-01', '2026-05-27', '2026-05-31', '2026-08-09', '2026-11-08', '2026-12-25',
  // 2027 (estimated based on previous)
  '2027-01-01', '2027-02-06', '2027-02-07', '2027-03-10', '2027-03-26', '2027-05-01', '2027-05-16', '2027-05-20', '2027-08-09', '2027-10-29', '2027-12-25'
];

export const getObservedHolidays = (): Set<string> => {
  const observed = new Set<string>();
  const sortedBase = [...BASE_HOLIDAYS].sort();
  
  for (const dateStr of sortedBase) {
    const [y, m, d] = dateStr.split('-').map(Number);
    const date = new Date(y, m - 1, d);
    let current = new Date(date);
    
    // Format back to YYYY-MM-DD
    const formatDate = (d: Date) => {
      const obsY = d.getFullYear();
      const obsM = String(d.getMonth() + 1).padStart(2, '0');
      const obsD = String(d.getDate()).padStart(2, '0');
      return `${obsY}-${obsM}-${obsD}`;
    };

    // If it's Saturday or Sunday, move to next available Monday/Tuesday
    while (current.getDay() === 0 || current.getDay() === 6 || observed.has(formatDate(current))) {
      current.setDate(current.getDate() + 1);
    }
    
    observed.add(formatDate(current));
  }
  
  return observed;
};
