export interface SessionAnalytics {
  sessionId: string;
  startTime: number;
  endTime?: number;
  duration?: number;
  focusTime?: number;
  averageFocus?: number;
  videoId: string;
  videoTitle?: string;
  emotionTimeline: {
    timestamp: number;
    videoTime: number;
    emotion: string;
    attention: number;
  }[];
  events: {
    timestamp: number;
    videoTime: number;
    type: 'quiz' | 'summary' | 'pause' | 'play';
    details?: any;
  }[];
  quizResults: {
    id?: string;
    timestamp: number;
    videoTime: number;
    totalQuestions: number;
    correctAnswers: number;
    score?: number;
  }[];
}

export async function saveSession(session: SessionAnalytics): Promise<void> {
  if (typeof window === 'undefined') return;

  try {
    await fetch('/api/sessions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(session),
      keepalive: true,
    });
  } catch (error) {
    console.error('Failed to save session to SQLite database:', error);
  }
}

export async function getSessions(): Promise<SessionAnalytics[]> {
  if (typeof window === 'undefined') return [];

  try {
    const res = await fetch('/api/sessions', {
      method: 'GET',
      headers: {
        'Cache-Control': 'no-cache',
      },
    });

    if (!res.ok) {
      throw new Error(`Failed to fetch sessions: ${res.statusText}`);
    }

    const data = await res.json();
    return data.sessions || [];
  } catch (error) {
    console.error('Failed to retrieve sessions from SQLite database:', error);
    return [];
  }
}

export async function saveQuizResult(data: {
  sessionId: string;
  score?: number;
  totalQuestions: number;
  correctAnswers: number;
  videoTime: number;
  timestamp?: number;
  videoId?: string;
}): Promise<void> {
  if (typeof window === 'undefined') return;

  try {
    await fetch('/api/quiz-results', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
      keepalive: true,
    });
  } catch (error) {
    console.error('Failed to save quiz result to SQLite database:', error);
  }
}

export interface DailyStats {
  currentStreak: number;
  todayWatchTimeMinutes: number;
  todayAverageFocus: number;
  todaySessionsCount: number;
  todayQuizzesCount: number;
  daysActive: number;
}

export function calculateDailyStats(sessions: SessionAnalytics[]): DailyStats {
  if (!sessions || sessions.length === 0) {
    return {
      currentStreak: 0,
      todayWatchTimeMinutes: 0,
      todayAverageFocus: 0,
      todaySessionsCount: 0,
      todayQuizzesCount: 0,
      daysActive: 0,
    };
  }

  const getLocalDateKey = (ts: number): string => {
    const d = new Date(ts);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const todayKey = getLocalDateKey(Date.now());
  const yesterdayDate = new Date();
  yesterdayDate.setDate(yesterdayDate.getDate() - 1);
  const yesterdayKey = getLocalDateKey(yesterdayDate.getTime());

  // Group sessions by local day
  const sessionsByDay: Record<string, SessionAnalytics[]> = {};
  for (const s of sessions) {
    const key = getLocalDateKey(s.startTime);
    if (!sessionsByDay[key]) {
      sessionsByDay[key] = [];
    }
    sessionsByDay[key].push(s);
  }

  const uniqueDays = Object.keys(sessionsByDay).sort();
  const daysActive = uniqueDays.length;

  // Streak calculation: count consecutive days backwards
  let currentStreak = 0;
  const checkDate = new Date();

  if (sessionsByDay[todayKey] && sessionsByDay[todayKey].length > 0) {
    while (true) {
      const key = getLocalDateKey(checkDate.getTime());
      if (sessionsByDay[key] && sessionsByDay[key].length > 0) {
        currentStreak++;
        checkDate.setDate(checkDate.getDate() - 1);
      } else {
        break;
      }
    }
  } else if (sessionsByDay[yesterdayKey] && sessionsByDay[yesterdayKey].length > 0) {
    checkDate.setDate(checkDate.getDate() - 1);
    while (true) {
      const key = getLocalDateKey(checkDate.getTime());
      if (sessionsByDay[key] && sessionsByDay[key].length > 0) {
        currentStreak++;
        checkDate.setDate(checkDate.getDate() - 1);
      } else {
        break;
      }
    }
  }

  // Today's stats calculation
  const todaySessions = sessionsByDay[todayKey] || [];
  let todayWatchTimeMinutes = 0;
  let todayFocusSum = 0;
  let todayFocusCount = 0;
  let todayQuizzesCount = 0;

  for (const s of todaySessions) {
    const sessionDurationMs = (s.endTime || Date.now()) - s.startTime;
    const sessionMinutes = Math.max(1, Math.round(sessionDurationMs / 60000));
    todayWatchTimeMinutes += sessionMinutes;

    const avgFocus =
      s.averageFocus !== undefined
        ? s.averageFocus
        : s.emotionTimeline && s.emotionTimeline.length > 0
        ? s.emotionTimeline.reduce((acc, curr) => acc + curr.attention, 0) / s.emotionTimeline.length
        : 100;

    todayFocusSum += avgFocus;
    todayFocusCount++;

    todayQuizzesCount += (s.quizResults || []).length;
  }

  const todayAverageFocus =
    todayFocusCount > 0 ? Math.round(todayFocusSum / todayFocusCount) : 0;

  return {
    currentStreak,
    todayWatchTimeMinutes,
    todayAverageFocus,
    todaySessionsCount: todaySessions.length,
    todayQuizzesCount,
    daysActive,
  };
}

