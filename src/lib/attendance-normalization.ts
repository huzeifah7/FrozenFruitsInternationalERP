export function normalizeWorkEntries(entries: any[], startDateStr: string, endDateStr: string) {
  // Deep clone entries and store them in a map by date
  const entryMap = new Map<string, any>();
  (entries || []).forEach(entry => {
    if (entry.date) {
      entryMap.set(entry.date, { ...entry });
    }
  });

  // Generate all dates in the period
  const dates: string[] = [];
  const currentDate = new Date(startDateStr);
  const end = new Date(endDateStr);
  currentDate.setHours(0, 0, 0, 0);
  end.setHours(0, 0, 0, 0);

  while (currentDate <= end) {
    const year = currentDate.getFullYear();
    const month = String(currentDate.getMonth() + 1).padStart(2, '0');
    const day = String(currentDate.getDate()).padStart(2, '0');
    dates.push(`${year}-${month}-${day}`);
    currentDate.setDate(currentDate.getDate() + 1);
  }

  // Helper functions for time calculation
  const parseTime = (t: string) => {
    if (!t) return 0;
    const [h, m] = t.split(':').map(Number);
    if (isNaN(h)) return 0;
    return h * 60 + (m || 0);
  };
  const formatTime = (mins: number) => {
    const h = Math.floor(mins / 60);
    const m = Math.floor(mins % 60);
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  };

  // --- Step 1: Base Calculation & Daily Cap (Max 8h) ---
  dates.forEach(dateStr => {
    const entry = entryMap.get(dateStr);
    if (!entry) return;

    const st1 = entry.startTime1 || '';
    const et1 = entry.endTime1 || '';
    const st2 = entry.startTime2 || '';
    const et2 = entry.endTime2 || '';

    const t1 = parseTime(st1);
    const t2 = parseTime(et1);
    const d1 = (t2 >= t1 && st1 && et1) ? t2 - t1 : 0;

    const t3 = parseTime(st2);
    const t4 = parseTime(et2);
    const d2 = (t4 >= t3 && st2 && et2) ? t4 - t3 : 0;

    // Recalculate total hours strictly from times
    let totalMins = d1 + d2;
    if (totalMins > 8 * 60) totalMins = 8 * 60; // Daily cap
    
    entry.totalHours = totalMins / 60;
  });

  // --- Group dates by Calendar Week (Monday to Sunday) ---
  const weeks = new Map<string, string[]>();
  dates.forEach(dateStr => {
    const d = new Date(dateStr);
    d.setHours(0, 0, 0, 0);
    const dayOfWeek = d.getDay(); // 0 = Sunday, 1 = Monday
    const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const monday = new Date(d);
    monday.setDate(d.getDate() + diffToMonday);
    
    const mYear = monday.getFullYear();
    const mMonth = String(monday.getMonth() + 1).padStart(2, '0');
    const mDay = String(monday.getDate()).padStart(2, '0');
    const mondayStr = `${mYear}-${mMonth}-${mDay}`;
    
    if (!weeks.has(mondayStr)) weeks.set(mondayStr, []);
    weeks.get(mondayStr)!.push(dateStr);
  });

  // --- Step 2 & 3: Mandatory Rest Day & Weekly Cap (44h) ---
  weeks.forEach((weekDates, mondayStr) => {
    let daysWorked = 0;
    weekDates.forEach(dateStr => {
      const entry = entryMap.get(dateStr);
      if (entry && Number(entry.totalHours) > 0) daysWorked++;
    });

    // Step 2: Mandatory Rest Day logic removed per user request.

    // Step 3: Weekly Cap 44h
    let weeklySum = 0;
    weekDates.forEach(dateStr => {
      const entry = entryMap.get(dateStr);
      if (entry) {
        const isHol = entry.isHoliday === true || entry.holidayShift === true || entry.holidayShift === 'Yes';
        const h = isHol ? 8 : Number(entry.totalHours || 0);
        weeklySum += h;
      }
    });

    if (weeklySum > 44) {
      for (let i = weekDates.length - 1; i >= 0; i--) {
        if (weeklySum <= 44) break;
        const entry = entryMap.get(weekDates[i]);
        const isHol = entry && (entry.isHoliday === true || entry.holidayShift === true || entry.holidayShift === 'Yes');
        if (entry && !isHol && Number(entry.totalHours) > 0) {
          const excess = weeklySum - 44;
          const currH = Number(entry.totalHours);
          if (currH > excess) {
            entry.totalHours = currH - excess;
            weeklySum -= excess;
          } else {
            entry.totalHours = 0;
            weeklySum -= currH;
          }
        }
      }
    }
  });

  // --- Step 4: Quinzaine Cap (95.5h) ---
  // Group dates by Quinzaine (Year-Month-Q1 or Q2)
  const quinzaines = new Map<string, string[]>();
  dates.forEach(dateStr => {
    const d = new Date(dateStr);
    const yearMonth = dateStr.substring(0, 7); // YYYY-MM
    const day = d.getDate();
    const qKey = `${yearMonth}-${day <= 15 ? 'Q1' : 'Q2'}`;
    
    if (!quinzaines.has(qKey)) quinzaines.set(qKey, []);
    quinzaines.get(qKey)!.push(dateStr);
  });

  quinzaines.forEach((qDates, qKey) => {
    let qSum = 0;
    qDates.forEach(dateStr => {
      const entry = entryMap.get(dateStr);
      if (entry) {
        const isHol = entry.isHoliday === true || entry.holidayShift === true || entry.holidayShift === 'Yes';
        const h = isHol ? 8 : Number(entry.totalHours || 0);
        qSum += h;
      }
    });

    if (qSum > 95.5) {
      for (let i = qDates.length - 1; i >= 0; i--) {
        if (qSum <= 95.5) break;
        const entry = entryMap.get(qDates[i]);
        const isHol = entry && (entry.isHoliday === true || entry.holidayShift === true || entry.holidayShift === 'Yes');
        if (entry && !isHol && Number(entry.totalHours) > 0) {
          const excess = qSum - 95.5;
          const currH = Number(entry.totalHours);
          if (currH > excess) {
            entry.totalHours = currH - excess;
            qSum -= excess;
          } else {
            entry.totalHours = 0;
            qSum -= currH;
          }
        }
      }
    }
  });



  return Array.from(entryMap.values());
}
