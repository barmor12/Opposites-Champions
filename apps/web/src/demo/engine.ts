/**
 * מנוע משחק לגרסת הדמו – "שרת" שרץ בזיכרון הדפדפן.
 * מממש את אותו חוזה (REST + אירועי Socket) שהלקוח מצפה לו מהשרת האמיתי, כולל:
 * חדרים מוגדרים מראש, חברים לכיתה מדומים, ניקוד לפי `calculateScore`, דירוג עם הכרעת שוויון והישגים.
 * אין כאן אבטחה או התמדה – זו תצוגה בלבד.
 */
import {
  AchievementType,
  AVATARS,
  COUNTDOWN_SECONDS,
  GameMode,
  GameState,
  MAX_DISPLAY_NAME,
  MIN_DISPLAY_NAME,
  QuestionType,
  TREASURE_BONUS,
  TREASURE_QUESTIONS,
  calculateMatchScore,
  calculateScore,
  rankEntries,
  validateDisplayName,
  type AchievementAward,
  type AnswerPayload,
  type AnswerResult,
  type AvatarId,
  type GameSettings,
  type Leaderboard,
  type LeaderboardEntry,
  type ParticipantView,
  type PlayerSession,
  type QuestionView,
  type RoomPublicView,
  type ServerToClientEvents,
} from '@oc/shared';
import { generateQuestions, toView, type DemoQuestion } from './questions';
import { storage } from '@/lib/storage';

// ===== חדרי דמו =====
export interface DemoRoomPreset {
  code: string;
  title: string;
  blurb: string;
  settings: GameSettings;
}

const ALL_CATEGORIES: GameSettings['categories'] = [
  'SIZES', 'COLORS_LIGHT', 'EMOTIONS', 'ACTIONS', 'TIME_SPEED', 'DIRECTIONS_PLACES', 'ANIMALS_NATURE', 'TRAITS_STATES', 'OBJECTS_ENVIRONMENT', 'CHALLENGING',
];

const common = {
  mode: GameMode.SELF_PACED,
  competitionEnabled: true,
  showLeaderboard: true,
  showCorrectAnswers: true,
  soundsEnabled: true,
  categories: ALL_CATEGORIES,
} as const;

export const DEMO_ROOMS: DemoRoomPreset[] = [
  {
    code: '111111',
    title: 'משחק מעורב',
    blurb: 'כל סוגי השאלות, 20 שניות לשאלה, אתגר האוצר בסוף',
    settings: { ...common, className: 'כיתה ג׳1', questionCount: 10, difficulty: 'MIXED', timePerQuestionSec: 20, questionTypes: [QuestionType.CHOOSE_OPPOSITE, QuestionType.CHOOSE_IMAGE, QuestionType.MATCH_PAIRS, QuestionType.COMPLETE_SENTENCE], treasureChallenge: true },
  },
  {
    code: '222222',
    title: 'רמה קלה – תמונות בלבד',
    blurb: 'בלי קריאה בכלל: איור מול איורים, ללא הגבלת זמן',
    settings: { ...common, className: 'כיתה ב׳2', questionCount: 8, difficulty: 'EASY', timePerQuestionSec: 0, questionTypes: [QuestionType.PICTURE_TO_PICTURE], treasureChallenge: false },
  },
  {
    code: '333333',
    title: 'אתגר קשה',
    blurb: 'מילים מאתגרות, 15 שניות לשאלה, אתגר האוצר',
    settings: { ...common, className: 'כיתה ג׳3', questionCount: 10, difficulty: 'HARD', timePerQuestionSec: 15, questionTypes: [QuestionType.CHOOSE_OPPOSITE, QuestionType.COMPLETE_SENTENCE], treasureChallenge: true },
  },
];

// ===== טיפוסים פנימיים =====
interface Progress {
  currentIndex: number;
  questionStartedAt: number;
  score: number;
  correct: number;
  answered: number;
  totalMs: number;
  streak: number;
  bestStreak: number;
  treasureCorrect: number;
  finished: boolean;
  lastResult: AnswerResult | null;
  answeredIds: Set<string>;
}

interface Participant {
  id: string;
  displayName: string;
  avatar: AvatarId;
  bot: boolean;
  connected: boolean;
  progress: Progress;
  /** בוטים: דיוק 0..1 ומהירות יחסית */
  accuracy: number;
  pace: number;
}

export class DemoError extends Error {
  constructor(readonly status: number, message: string, readonly code = 'DEMO') {
    super(message);
  }
}

type Emit = <E extends keyof ServerToClientEvents>(event: E, ...args: Parameters<ServerToClientEvents[E]>) => void;

const BOT_POOL: Array<{ name: string; avatar: AvatarId; accuracy: number; pace: number }> = [
  { name: 'נועה', avatar: 'fox', accuracy: 0.85, pace: 0.8 },
  { name: 'איתי', avatar: 'dino', accuracy: 0.6, pace: 1.3 },
  { name: 'מאיה', avatar: 'panda', accuracy: 0.75, pace: 1 },
  { name: 'יונתן', avatar: 'lion', accuracy: 0.7, pace: 0.9 },
  { name: 'תמר', avatar: 'owl', accuracy: 0.9, pace: 1.2 },
  { name: 'דניאל', avatar: 'frog', accuracy: 0.55, pace: 0.7 },
];

const BEST_KEY = 'oc.demo.personalBest';

function freshProgress(): Progress {
  return { currentIndex: 0, questionStartedAt: 0, score: 0, correct: 0, answered: 0, totalMs: 0, streak: 0, bestStreak: 0, treasureCorrect: 0, finished: false, lastResult: null, answeredIds: new Set() };
}

function uid(): string {
  const a = new Uint8Array(16);
  crypto.getRandomValues(a);
  return Array.from(a, (b) => b.toString(16).padStart(2, '0')).join('');
}

/** מנוע הדמו – מופע יחיד לכל הדף */
export class DemoEngine {
  private preset: DemoRoomPreset | null = null;
  private roomId = '';
  private sessionId = '';
  private round = 0;
  private state: GameState = GameState.CREATED;
  private joinOpen = true;
  private questions: DemoQuestion[] = [];
  private me: Participant | null = null;
  private token: string | null = null;
  private bots: Participant[] = [];
  private emit: Emit | null = null;
  private timers = new Set<number>();
  private leaderboardTimer: number | null = null;
  private socketConnected = false;

  // ===== חיבור socket מדומה =====
  attach(emit: Emit): void {
    this.emit = emit;
    this.socketConnected = true;
    this.maybeStart();
  }
  detach(): void {
    this.emit = null;
    this.socketConnected = false;
  }
  isValidToken(token: string | undefined): boolean {
    return Boolean(token) && token === this.token;
  }
  serverNow(): number {
    return Date.now();
  }

  // ===== REST =====
  presetByCode(code: string): DemoRoomPreset | null {
    return DEMO_ROOMS.find((r) => r.code === code) ?? null;
  }

  roomView(): RoomPublicView {
    if (!this.preset) throw new DemoError(404, 'לא מצאנו חדר עם הקוד הזה. בדקו את הקוד ונסו שוב');
    const s = this.preset.settings;
    return {
      roomId: this.roomId,
      code: this.preset.code,
      className: this.preset.settings.className,
      state: this.state,
      joinOpen: this.joinOpen,
      mode: s.mode,
      participantCount: this.participants().length,
      questionCount: s.questionCount,
      currentQuestionIndex: null,
      settings: { timePerQuestionSec: s.timePerQuestionSec, showLeaderboard: s.showLeaderboard, showCorrectAnswers: s.showCorrectAnswers, soundsEnabled: s.soundsEnabled, competitionEnabled: s.competitionEnabled },
    };
  }

  join(req: { code?: string; displayName?: string; avatar?: string }): { participantId: string; sessionToken: string; displayName: string; avatar: AvatarId; room: RoomPublicView } {
    const preset = this.presetByCode(String(req.code ?? '').trim());
    if (!preset) throw new DemoError(404, 'לא מצאנו חדר עם הקוד הזה. נסו אחד מקודי הדמו');
    const name = validateDisplayName(String(req.displayName ?? ''));
    if (!name.ok) throw new DemoError(400, name.reason ?? `השם צריך להיות באורך ${MIN_DISPLAY_NAME}–${MAX_DISPLAY_NAME} תווים`);
    const avatar = String(req.avatar ?? '') as AvatarId;
    if (!AVATARS.includes(avatar)) throw new DemoError(400, 'בחרו דמות');

    this.resetAll();
    this.preset = preset;
    this.roomId = uid();
    this.round = 1;
    this.sessionId = uid();
    this.state = GameState.WAITING_FOR_PLAYERS;
    this.token = uid() + uid();
    this.me = { id: uid(), displayName: name.normalized, avatar, bot: false, connected: true, progress: freshProgress(), accuracy: 1, pace: 1 };
    this.scheduleBotJoins();
    return { participantId: this.me.id, sessionToken: this.token, displayName: this.me.displayName, avatar, room: this.roomView() };
  }

  session(): PlayerSession {
    const me = this.requireMe();
    const p = me.progress;
    const q = this.state === GameState.QUESTION_ACTIVE && !p.finished ? this.questions[p.currentIndex] : undefined;
    return {
      participantId: me.id,
      displayName: me.displayName,
      avatar: me.avatar,
      room: this.roomView(),
      gameSessionId: this.sessionId || null,
      score: p.score,
      correctAnswers: p.correct,
      answeredCount: p.answered,
      finished: p.finished,
      currentQuestion: q ? toView(q, this.questions.length, p.questionStartedAt) : null,
      lastResult: q && p.lastResult?.sessionQuestionId === q.id ? p.lastResult : null,
      achievements: this.achievementsFor(me.id),
    };
  }

  progress(): { score: number; correctAnswers: number; answeredCount: number; finished: boolean; currentIndex: number; total: number; achievements: AchievementType[] } {
    const me = this.requireMe();
    const p = me.progress;
    return { score: p.score, correctAnswers: p.correct, answeredCount: p.answered, finished: p.finished, currentIndex: p.currentIndex, total: this.questions.length, achievements: this.achievementsFor(me.id) };
  }

  /** "המורה פתחה סבב חדש" – אותם משתתפים, ניקוד מאופס */
  newRound(): void {
    if (!this.preset || !this.me) return;
    if (this.state !== GameState.COMPLETED && this.state !== GameState.FINAL_RESULTS) return;
    this.clearTimers();
    this.round += 1;
    this.sessionId = uid();
    this.awards = [];
    this.state = GameState.WAITING_FOR_PLAYERS;
    for (const p of this.participants()) p.progress = freshProgress();
    this.broadcastRoom();
    this.after(2600, () => this.maybeStart(true));
  }

  // ===== Socket =====
  handle(event: string, payload: unknown, ack?: (r: unknown) => void): void {
    const ok = (data: unknown) => ack?.({ ok: true, data });
    const fail = (code: string, message: string) => ack?.({ ok: false, error: { code, message } });
    try {
      switch (event) {
        case 'time:ping':
          ack?.(Date.now());
          return;
        case 'player:join':
          ok({ ok: true });
          return;
        case 'answer:submit':
          ok(this.submit(payload as AnswerPayload));
          return;
        case 'question:next':
          ok(this.next((payload as { sessionQuestionId?: string }).sessionQuestionId ?? ''));
          return;
        default:
          fail('UNKNOWN_EVENT', 'אירוע לא מוכר');
      }
    } catch (err) {
      if (err instanceof DemoError) fail(err.code, err.message);
      else fail('INTERNAL', 'אופס! משהו השתבש');
    }
  }

  // ===== זרימת משחק =====
  private scheduleBotJoins(): void {
    const count = 4 + Math.floor(Math.random() * 3); // 4–6 חברים לכיתה
    const picked = [...BOT_POOL].sort(() => Math.random() - 0.5).slice(0, count);
    picked.forEach((b, i) => {
      this.after(900 + i * 700, () => {
        if (this.state !== GameState.WAITING_FOR_PLAYERS) return;
        const bot: Participant = { id: uid(), displayName: b.name, avatar: b.avatar, bot: true, connected: true, progress: freshProgress(), accuracy: b.accuracy, pace: b.pace };
        this.bots.push(bot);
        this.emit?.('player:connected', { participantId: bot.id, displayName: bot.displayName, participantCount: this.participants().length });
        this.broadcastRoom();
        if (i === picked.length - 1) this.after(1800, () => this.maybeStart(true));
      });
    });
  }

  private startRequested = false;
  private maybeStart(request = false): void {
    if (request) this.startRequested = true;
    if (!this.startRequested || !this.socketConnected || !this.emit || this.state !== GameState.WAITING_FOR_PLAYERS) return;
    this.startRequested = false;
    this.start();
  }

  private start(): void {
    if (!this.preset || !this.me) return;
    this.joinOpen = false;
    this.state = GameState.COUNTDOWN;
    this.questions = generateQuestions(this.preset.settings, `${this.sessionId}:${this.round}`);
    const now = Date.now();
    this.emit?.('game:countdown', { seconds: COUNTDOWN_SECONDS, startsAt: now, serverNow: now });
    this.broadcastRoom();
    this.after(COUNTDOWN_SECONDS * 1000, () => {
      if (!this.preset) return;
      this.state = GameState.QUESTION_ACTIVE;
      this.emit?.('game:started', { gameSessionId: this.sessionId, mode: this.preset.settings.mode, questionCount: this.questions.length });
      for (const p of this.participants()) p.progress.questionStartedAt = Date.now();
      this.emit?.('question:started', this.currentViewFor(this.requireMe())!);
      for (const bot of this.bots) this.scheduleBot(bot);
      this.pushLeaderboard();
    });
  }

  private currentViewFor(p: Participant): QuestionView | null {
    const q = this.questions[p.progress.currentIndex];
    return q ? toView(q, this.questions.length, p.progress.questionStartedAt) : null;
  }

  private submit(payload: AnswerPayload): AnswerResult {
    const me = this.requireMe();
    if (this.state !== GameState.QUESTION_ACTIVE) throw new DemoError(409, 'המשחק לא פעיל כרגע', 'GAME_NOT_ACTIVE');
    const q = this.questions[me.progress.currentIndex];
    if (!q || q.id !== payload.sessionQuestionId) throw new DemoError(400, 'השאלה הזו כבר לא פעילה', 'QUESTION_MISMATCH');
    if (me.progress.answeredIds.has(q.id)) throw new DemoError(409, 'כבר ענית על השאלה הזו', 'ALREADY_ANSWERED');
    const elapsedRaw = Date.now() - me.progress.questionStartedAt;
    const elapsed = q.timeLimitMs > 0 ? Math.min(Math.max(0, elapsedRaw), q.timeLimitMs) : Math.max(0, elapsedRaw);
    const check = this.check(q, payload);
    const score = q.type === QuestionType.MATCH_PAIRS
      ? calculateMatchScore(check.matched, check.total, check.mistakes, elapsed, q.timeLimitMs)
      : calculateScore(check.correct, elapsed, q.timeLimitMs);
    return this.record(me, q, check.correct, score, elapsed, check);
  }

  private check(q: DemoQuestion, payload: AnswerPayload): { correct: boolean; matched: number; total: number; mistakes: number; correctOptionId?: string; correctMatches?: Array<{ cardA: string; cardB: string }> } {
    if (q.type === QuestionType.MATCH_PAIRS && q.pairs) {
      if (!('matches' in payload) || !Array.isArray(payload.matches)) throw new DemoError(400, 'תשובה לא תקינה לשאלת התאמה', 'INVALID_ANSWER');
      const key = (a: string, b: string) => (a < b ? `${a}|${b}` : `${b}|${a}`);
      const correctKeys = new Set(q.pairs.map((p) => key(p.cardA, p.cardB)));
      const seen = new Set<string>();
      let matched = 0;
      let mistakes = 0;
      for (const m of payload.matches) {
        if (!m || typeof m.cardA !== 'string' || typeof m.cardB !== 'string' || m.cardA === m.cardB) {
          mistakes += 1;
          continue;
        }
        const k = key(m.cardA, m.cardB);
        if (seen.has(k)) continue;
        seen.add(k);
        if (correctKeys.has(k)) matched += 1;
        else mistakes += 1;
      }
      return { correct: matched === q.pairs.length, matched, total: q.pairs.length, mistakes, correctMatches: q.pairs.map((p) => ({ ...p })) };
    }
    if (!('optionId' in payload) || typeof payload.optionId !== 'string') throw new DemoError(400, 'יש לבחור תשובה', 'INVALID_ANSWER');
    const option = q.options.find((o) => o.id === payload.optionId);
    if (!option) throw new DemoError(400, 'התשובה שנבחרה אינה שייכת לשאלה', 'INVALID_OPTION');
    const correctOptionId = q.options.find((o) => o.isCorrect)?.id;
    return { correct: option.isCorrect, matched: option.isCorrect ? 1 : 0, total: 1, mistakes: option.isCorrect ? 0 : 1, ...(correctOptionId ? { correctOptionId } : {}) };
  }

  private record(p: Participant, q: DemoQuestion, correct: boolean, score: number, elapsed: number, info: { correctOptionId?: string; correctMatches?: Array<{ cardA: string; cardB: string }> }): AnswerResult {
    const pr = p.progress;
    pr.answeredIds.add(q.id);
    pr.answered += 1;
    pr.totalMs += elapsed;
    pr.streak = correct ? pr.streak + 1 : 0;
    pr.bestStreak = Math.max(pr.bestStreak, pr.streak);
    if (correct) pr.correct += 1;
    let bonus = 0;
    let treasureCompleted = false;
    if (q.isTreasure && correct) {
      pr.treasureCorrect += 1;
      if (q.treasureStep === TREASURE_QUESTIONS && pr.treasureCorrect >= TREASURE_QUESTIONS) {
        bonus = TREASURE_BONUS;
        treasureCompleted = true;
      }
    }
    pr.score += score + bonus;
    const result: AnswerResult = {
      sessionQuestionId: q.id,
      correct,
      scoreAwarded: score + bonus,
      totalScore: pr.score,
      ...(info.correctOptionId ? { correctOptionId: info.correctOptionId } : {}),
      ...(info.correctMatches ? { correctMatches: info.correctMatches } : {}),
      explanation: q.explanation,
      elapsedMs: elapsed,
      streak: pr.streak,
      ...(treasureCompleted ? { treasureCompleted: true, treasureBonus: bonus } : {}),
    };
    pr.lastResult = result;
    this.pushLeaderboard();
    return result;
  }

  private next(sessionQuestionId: string): { question: QuestionView | null; finished: boolean } {
    const me = this.requireMe();
    if (this.state !== GameState.QUESTION_ACTIVE) throw new DemoError(409, 'המשחק לא פעיל כרגע', 'GAME_NOT_ACTIVE');
    const q = this.questions[me.progress.currentIndex];
    if (!q) return { question: null, finished: true };
    if (q.id !== sessionQuestionId) {
      // כבר התקדמנו – מחזירים את השאלה הנוכחית
      return { question: this.currentViewFor(me), finished: me.progress.finished };
    }
    if (!me.progress.answeredIds.has(q.id)) {
      // פג הזמן בלי תשובה – נרשם כשגוי (כמו בשרת)
      const correctOptionId = q.options.find((o) => o.isCorrect)?.id;
      this.record(me, q, false, 0, q.timeLimitMs, { ...(correctOptionId ? { correctOptionId } : {}), ...(q.pairs ? { correctMatches: q.pairs } : {}) });
    }
    return this.advance(me);
  }

  private advance(p: Participant): { question: QuestionView | null; finished: boolean } {
    p.progress.currentIndex += 1;
    p.progress.lastResult = null;
    if (p.progress.currentIndex >= this.questions.length) {
      p.progress.finished = true;
      this.emit?.('player:finished', { participantId: p.id, finishedCount: this.participants().filter((x) => x.progress.finished).length, participantCount: this.participants().length });
      this.pushLeaderboard();
      this.checkAllFinished();
      return { question: null, finished: true };
    }
    p.progress.questionStartedAt = Date.now();
    return { question: this.currentViewFor(p), finished: false };
  }

  private checkAllFinished(): void {
    if (this.state !== GameState.QUESTION_ACTIVE) return;
    const all = this.participants();
    if (all.every((p) => p.progress.finished)) {
      this.after(1200, () => this.finish());
      return;
    }
    // התלמיד סיים לפני החברים – "המורה" מסיימת את הסבב אחרי רגע
    if (this.me?.progress.finished) this.after(6000, () => this.finish());
  }

  private awards: AchievementAward[] = [];
  private finish(): void {
    if (!this.me || this.state !== GameState.QUESTION_ACTIVE) return;
    this.clearTimers();
    this.state = GameState.FINAL_RESULTS;
    const lb = this.leaderboard();
    const best = Number(storage.get(BEST_KEY) ?? 0);
    const awards: AchievementAward[] = [];
    for (const e of lb.entries) {
      const p = this.participants().find((x) => x.id === e.participantId);
      if (!p) continue;
      const pr = p.progress;
      if (e.rank === 1 && pr.correct >= 1) awards.push({ type: AchievementType.OPPOSITES_CHAMPION, participantId: p.id });
      if (pr.finished && pr.answered >= this.questions.length) awards.push({ type: AchievementType.PERSISTENCE_CHAMPION, participantId: p.id });
      if (pr.correct >= 10) awards.push({ type: AchievementType.TEN_CORRECT, participantId: p.id });
      if (pr.bestStreak >= 5) awards.push({ type: AchievementType.FIVE_STREAK, participantId: p.id });
      if (pr.answered >= 5 && pr.correct / pr.answered >= 0.9) awards.push({ type: AchievementType.ACCURACY_CHAMPION, participantId: p.id });
      if (!p.bot && pr.score > best && pr.score > 0) {
        awards.push({ type: AchievementType.PERSONAL_BEST, participantId: p.id });
        storage.set(BEST_KEY, String(pr.score));
      }
    }
    this.awards = awards;
    this.emit?.('game:finished', { gameSessionId: this.sessionId, leaderboard: lb });
    if (awards.length) this.emit?.('achievement:awarded', awards);
    this.state = GameState.COMPLETED;
  }

  // ===== בוטים =====
  private scheduleBot(bot: Participant): void {
    const q = this.questions[bot.progress.currentIndex];
    if (!q || bot.progress.finished || this.state !== GameState.QUESTION_ACTIVE) return;
    const limit = q.timeLimitMs > 0 ? q.timeLimitMs : 20_000;
    const think = Math.min(limit * 0.9, (2500 + Math.random() * 6500) * bot.pace);
    this.after(think, () => {
      if (this.state !== GameState.QUESTION_ACTIVE) return;
      const correct = Math.random() < bot.accuracy;
      const elapsed = Math.round(think);
      let score: number;
      let info: { correctOptionId?: string; correctMatches?: Array<{ cardA: string; cardB: string }> } = {};
      if (q.type === QuestionType.MATCH_PAIRS && q.pairs) {
        const matched = correct ? q.pairs.length : Math.floor(Math.random() * q.pairs.length);
        score = calculateMatchScore(matched, q.pairs.length, correct ? (Math.random() < 0.6 ? 0 : 1) : 2, elapsed, q.timeLimitMs);
        info = { correctMatches: q.pairs };
      } else {
        score = calculateScore(correct, elapsed, q.timeLimitMs);
        const id = q.options.find((o) => o.isCorrect)?.id;
        info = id ? { correctOptionId: id } : {};
      }
      this.record(bot, q, correct, score, elapsed, info);
      this.after(900 + Math.random() * 1200, () => {
        if (this.state !== GameState.QUESTION_ACTIVE) return;
        this.advance(bot);
        this.scheduleBot(bot);
      });
    });
  }

  // ===== דירוג =====
  leaderboard(): Leaderboard {
    const rows = this.participants().map((p) => ({ participantId: p.id, score: p.progress.score, correctAnswers: p.progress.correct, totalResponseMs: p.progress.totalMs, p }));
    const entries: LeaderboardEntry[] = rankEntries(rows).map(({ entry, rank }) => ({
      participantId: entry.participantId,
      displayName: entry.p.displayName,
      avatar: entry.p.avatar,
      score: entry.score,
      correctAnswers: entry.correctAnswers,
      answeredCount: entry.p.progress.answered,
      accuracy: entry.p.progress.answered ? Math.round((entry.correctAnswers / entry.p.progress.answered) * 100) : 0,
      totalResponseMs: entry.totalResponseMs,
      rank,
      connected: entry.p.connected,
      finished: entry.p.progress.finished,
    }));
    return { gameSessionId: this.sessionId, entries, updatedAt: Date.now() };
  }

  private pushLeaderboard(): void {
    if (this.leaderboardTimer !== null) return;
    this.leaderboardTimer = window.setTimeout(() => {
      this.leaderboardTimer = null;
      if (this.state === GameState.QUESTION_ACTIVE || this.state === GameState.WAITING_FOR_PLAYERS) this.emit?.('leaderboard:updated', this.leaderboard());
    }, 400);
  }

  private broadcastRoom(): void {
    if (!this.preset) return;
    const participants: ParticipantView[] = this.participants().map((p) => ({ id: p.id, displayName: p.displayName, avatar: p.avatar, connected: p.connected, finished: p.progress.finished, answeredCount: p.progress.answered, score: p.progress.score }));
    this.emit?.('room:updated', { room: this.roomView(), participants });
  }

  private achievementsFor(participantId: string): AchievementType[] {
    return this.awards.filter((a) => a.participantId === participantId).map((a) => a.type);
  }

  // ===== עזר =====
  private participants(): Participant[] {
    return this.me ? [this.me, ...this.bots] : [];
  }
  private requireMe(): Participant {
    if (!this.me || !this.preset) throw new DemoError(404, 'אין משחק פעיל. הצטרפו שוב עם קוד', 'NO_SESSION');
    return this.me;
  }
  private after(ms: number, fn: () => void): void {
    const id = window.setTimeout(() => {
      this.timers.delete(id);
      fn();
    }, ms);
    this.timers.add(id);
  }
  private clearTimers(): void {
    for (const id of this.timers) window.clearTimeout(id);
    this.timers.clear();
    if (this.leaderboardTimer !== null) {
      window.clearTimeout(this.leaderboardTimer);
      this.leaderboardTimer = null;
    }
  }
  private resetAll(): void {
    this.clearTimers();
    this.preset = null;
    this.me = null;
    this.bots = [];
    this.questions = [];
    this.awards = [];
    this.token = null;
    this.state = GameState.CREATED;
    this.joinOpen = true;
    this.startRequested = false;
  }
}

export const demoEngine = new DemoEngine();
