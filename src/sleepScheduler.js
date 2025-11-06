/**
 * Baby Sleep Scheduling Algorithm
 * 
 * This module generates sleep schedules based on baby's age, wake times, and sleep patterns.
 * It calculates wake windows, nap times, and bedtime recommendations.
 */

// ============================================================================
// CONFIGURATION
// ============================================================================

/**
 * Age-based wake window configuration (in minutes)
 * Format: [minAge, maxAge] -> { min: minutes, max: minutes }
 */
const WAKE_WINDOW_BY_AGE = {
  // 0-3 months: very short wake windows
  [0]: { min: 45, max: 90 },
  [1]: { min: 60, max: 90 },
  [2]: { min: 60, max: 105 },
  [3]: { min: 75, max: 120 },
  
  // 4-6 months: transitioning to longer wake windows
  [4]: { min: 90, max: 150 },
  [5]: { min: 120, max: 180 },
  [6]: { min: 120, max: 180 },
  
  // 7-9 months: longer wake windows
  [7]: { min: 150, max: 210 },
  [8]: { min: 150, max: 240 },
  [9]: { min: 180, max: 270 },
  
  // 10-12 months: even longer wake windows
  [10]: { min: 180, max: 270 },
  [11]: { min: 210, max: 300 },
  [12]: { min: 240, max: 300 },
  
  // 12+ months: toddler schedule
  [13]: { min: 240, max: 360 },
  [14]: { min: 300, max: 360 },
  [15]: { min: 300, max: 420 },
  [16]: { min: 300, max: 420 },
  [17]: { min: 360, max: 480 },
  [18]: { min: 360, max: 480 },
};

/**
 * Number of naps expected by age (in months)
 */
const NAPS_BY_AGE = {
  [0]: 4,   // 0-3 months: 4-5 naps
  [1]: 4,
  [2]: 4,
  [3]: 3,   // 3-5 months: 3-4 naps
  [4]: 3,
  [5]: 3,   // 5-7 months: 2-3 naps
  [6]: 2,
  [7]: 2,   // 7-15 months: 2 naps
  [8]: 2,
  [9]: 2,
  [10]: 2,
  [11]: 2,
  [12]: 2,
  [13]: 2,
  [14]: 2,
  [15]: 1,  // 15+ months: 1-2 naps, transitioning to 1
  [16]: 1,
  [17]: 1,
  [18]: 1,
};

/**
 * Estimated nap durations by age (in minutes)
 * Format: { firstNap: minutes, otherNaps: minutes }
 */
const NAP_DURATION_BY_AGE = {
  [0]: { firstNap: 60, otherNaps: 45 },
  [1]: { firstNap: 60, otherNaps: 45 },
  [2]: { firstNap: 90, otherNaps: 60 },
  [3]: { firstNap: 90, otherNaps: 60 },
  [4]: { firstNap: 90, otherNaps: 75 },
  [5]: { firstNap: 90, otherNaps: 75 },
  [6]: { firstNap: 90, otherNaps: 90 },
  [7]: { firstNap: 90, otherNaps: 90 },
  [8]: { firstNap: 90, otherNaps: 90 },
  [9]: { firstNap: 90, otherNaps: 90 },
  [10]: { firstNap: 90, otherNaps: 90 },
  [11]: { firstNap: 90, otherNaps: 90 },
  [12]: { firstNap: 90, otherNaps: 90 },
  [13]: { firstNap: 90, otherNaps: 90 },
  [14]: { firstNap: 90, otherNaps: 90 },
  [15]: { firstNap: 120, otherNaps: 0 }, // 1 nap
  [16]: { firstNap: 120, otherNaps: 0 },
  [17]: { firstNap: 120, otherNaps: 0 },
  [18]: { firstNap: 120, otherNaps: 0 },
};

// Algorithm parameters
const CATNAP_THRESHOLD = 45; // minutes - naps shorter than this are considered catnaps
const CATNAP_ADJUSTMENT = -30; // minutes to reduce next wake window after catnap
const EARLY_WAKE_THRESHOLD = 360; // 6:00 AM - wake before this is considered early
const EARLY_WAKE_ADJUSTMENT = -15; // minutes to reduce first wake window after early wake
const TARGET_BEDTIME_WINDOW = { start: 18.5, end: 20.5 }; // 6:30 PM - 8:30 PM in hours
const DST_ADJUSTMENT = 30; // minutes to adjust wake windows on DST days

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get configuration for a specific age
 */
function getConfigForAge(ageMonths) {
  const ageKey = Math.min(ageMonths, 18);
  
  return {
    wakeWindow: WAKE_WINDOW_BY_AGE[ageKey] || WAKE_WINDOW_BY_AGE[18],
    numberOfNaps: NAPS_BY_AGE[ageKey] || NAPS_BY_AGE[18],
    napDuration: NAP_DURATION_BY_AGE[ageKey] || NAP_DURATION_BY_AGE[18],
  };
}

/**
 * Convert hours (decimal) to Date
 */
function hoursToDate(hours, baseDate) {
  const date = new Date(baseDate);
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  date.setHours(h, m, 0, 0);
  return date;
}

/**
 * Convert Date to hours (decimal)
 */
function dateToHours(date) {
  return date.getHours() + date.getMinutes() / 60;
}

/**
 * Add minutes to a Date
 */
function addMinutes(date, minutes) {
  return new Date(date.getTime() + minutes * 60000);
}

/**
 * Check if a nap is a catnap
 */
function isCatnap(durationMinutes) {
  return durationMinutes < CATNAP_THRESHOLD;
}

/**
 * Check if wake time is early
 */
function isEarlyWake(wakeTime) {
  const hours = dateToHours(wakeTime);
  return hours < (EARLY_WAKE_THRESHOLD / 60);
}

// ============================================================================
// CORE SCHEDULING ALGORITHM
// ============================================================================

/**
 * Generate sleep schedule for today
 * 
 * @param {Object} params
 * @param {number} params.babyAgeMonths - Baby's age in months
 * @param {Date} params.firstWakeTimeToday - Time baby woke this morning
 * @param {Date} params.currentTime - Current time
 * @param {Array} params.actualNapDurations - Array of nap durations already taken (in minutes)
 * @param {Array} params.logs - Array of sleep/wake events for today
 * @param {boolean} params.timezoneOrDSTChangeFlag - True if DST/timezone shift occurred
 * @returns {Object} Schedule with nap times, wake windows, and bedtime
 */
export function generateSchedule({
  babyAgeMonths,
  firstWakeTimeToday,
  currentTime = new Date(),
  actualNapDurations = [],
  logs = [],
  timezoneOrDSTChangeFlag = false,
}) {
  // Get age-based configuration
  const config = getConfigForAge(babyAgeMonths);
  const { wakeWindow, numberOfNaps, napDuration } = config;
  
  // Calculate ideal wake window (use midpoint of min/max)
  let idealWakeWindow = (wakeWindow.min + wakeWindow.max) / 2;
  
  // Adjust for early wake
  if (isEarlyWake(firstWakeTimeToday)) {
    idealWakeWindow += EARLY_WAKE_ADJUSTMENT;
  }
  
  // Adjust for DST/timezone shift
  if (timezoneOrDSTChangeFlag) {
    idealWakeWindow += DST_ADJUSTMENT;
  }
  
  // Calculate how many naps have been taken
  const napsTaken = actualNapDurations.length;
  const napsRemaining = numberOfNaps - napsTaken;
  
  // Track current time for scheduling
  let scheduleTime = new Date(currentTime);
  
  // If we're before first wake time, use first wake time
  if (scheduleTime < firstWakeTimeToday) {
    scheduleTime = new Date(firstWakeTimeToday);
  }
  
  // Calculate last wake time (either from logs or first wake)
  let lastWakeTime = firstWakeTimeToday;
  if (logs.length > 0) {
    // Find the most recent wake event
    const wakeEvents = logs
      .filter(log => log.type === 'wake')
      .sort((a, b) => new Date(b.time) - new Date(a.time));
    if (wakeEvents.length > 0) {
      lastWakeTime = new Date(wakeEvents[0].time);
      if (lastWakeTime > scheduleTime) {
        scheduleTime = new Date(lastWakeTime);
      }
    }
  }
  
  // Adjust wake window based on last nap (if it was a catnap)
  if (actualNapDurations.length > 0) {
    const lastNapDuration = actualNapDurations[actualNapDurations.length - 1];
    if (isCatnap(lastNapDuration)) {
      idealWakeWindow += CATNAP_ADJUSTMENT;
    }
  }
  
  // Ensure wake window is within bounds
  idealWakeWindow = Math.max(wakeWindow.min, Math.min(wakeWindow.max, idealWakeWindow));
  
  // Generate schedule for remaining naps
  const scheduledNaps = [];
  let nextWakeTime = new Date(scheduleTime);
  
  for (let i = 0; i < napsRemaining; i++) {
    // Calculate nap start time (current time + wake window)
    const napStartTime = addMinutes(nextWakeTime, idealWakeWindow);
    
    // Determine nap duration
    const isFirstNap = napsTaken === 0 && i === 0;
    const estimatedDuration = isFirstNap ? napDuration.firstNap : napDuration.otherNaps;
    
    // Calculate nap end time
    const napEndTime = addMinutes(napStartTime, estimatedDuration);
    
    scheduledNaps.push({
      napNumber: napsTaken + i + 1,
      startTime: napStartTime,
      endTime: napEndTime,
      duration: estimatedDuration,
      wakeWindow: idealWakeWindow,
    });
    
    // Next wake time is after this nap
    nextWakeTime = new Date(napEndTime);
    
    // For subsequent naps, use slightly shorter wake windows
    if (i < napsRemaining - 1) {
      idealWakeWindow = Math.max(
        wakeWindow.min,
        idealWakeWindow - 15 // Slightly shorter for later naps
      );
    }
  }
  
  // Calculate bedtime
  // Target bedtime is after last nap + final wake window
  const lastNapEnd = scheduledNaps.length > 0 
    ? scheduledNaps[scheduledNaps.length - 1].endTime
    : nextWakeTime;
  
  // Final wake window before bedtime (slightly longer)
  const finalWakeWindow = idealWakeWindow + 30;
  let recommendedBedtime = addMinutes(lastNapEnd, finalWakeWindow);
  
  // Adjust bedtime to fit within target window if possible
  const bedtimeHours = dateToHours(recommendedBedtime);
  if (bedtimeHours < TARGET_BEDTIME_WINDOW.start) {
    // Too early, move to start of window
    recommendedBedtime = hoursToDate(TARGET_BEDTIME_WINDOW.start, recommendedBedtime);
  } else if (bedtimeHours > TARGET_BEDTIME_WINDOW.end) {
    // Too late, but keep it (might need to adjust wake windows)
    // Could shorten final wake window if needed
    const maxBedtime = hoursToDate(TARGET_BEDTIME_WINDOW.end, recommendedBedtime);
    if (recommendedBedtime > maxBedtime) {
      recommendedBedtime = maxBedtime;
    }
  }
  
  // Calculate night sleep duration (target: 11-12 hours for most ages)
  const nightSleepDuration = babyAgeMonths < 6 ? 660 : 720; // 11h or 12h in minutes
  
  return {
    scheduledNaps,
    recommendedBedtime,
    nightSleepDuration,
    idealWakeWindow,
    config: {
      numberOfNaps,
      wakeWindowRange: wakeWindow,
      napDuration,
    },
    adjustments: {
      earlyWake: isEarlyWake(firstWakeTimeToday),
      catnapDetected: actualNapDurations.some(d => isCatnap(d)),
      dstAdjustment: timezoneOrDSTChangeFlag,
    },
  };
}

/**
 * Format schedule for human-readable display
 */
export function formatSchedule(schedule) {
  const { scheduledNaps, recommendedBedtime, nightSleepDuration } = schedule;
  
  const lines = [];
  
  if (scheduledNaps.length === 0) {
    lines.push('No more naps scheduled for today.');
  } else {
    lines.push(`Next ${scheduledNaps.length} nap(s) scheduled:`);
    scheduledNaps.forEach((nap, index) => {
      const startTime = nap.startTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      const endTime = nap.endTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      const duration = Math.round(nap.duration);
      lines.push(`  Nap ${nap.napNumber}: ${startTime} - ${endTime} (~${duration} min)`);
    });
  }
  
  const bedtimeStr = recommendedBedtime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const nightHours = Math.floor(nightSleepDuration / 60);
  const nightMins = nightSleepDuration % 60;
  lines.push(`Recommended bedtime: ${bedtimeStr} (target night sleep: ${nightHours}h ${nightMins}m)`);
  
  return lines.join('\n');
}

