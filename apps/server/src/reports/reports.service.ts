import { Injectable } from '@nestjs/common';
import { QuestionType, type GameRoom, type GameSession } from '@prisma/client';
import ExcelJS from 'exceljs';
import { QUESTION_TYPE_LABELS, type AchievementType, type GameResults, type LeaderboardEntry, type QuestionStat } from '@oc/shared';
import { PrismaService } from '../prisma/prisma.service';
import { LeaderboardService } from '../leaderboard/leaderboard.service';
import { QuestionsService } from '../questions/questions.service';
import { GameError } from '../games/game-error';
import { parseQuestionPayload } from '../questions/question-payload';

export type ExportFormat = 'csv' | 'xlsx';

export interface ExportFile {
  filename: string;
  contentType: string;
  body: Buffer;
}

const HARDEST_COUNT = 5;

@Injectable()
export class ReportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly leaderboard: LeaderboardService,
    private readonly questions: QuestionsService,
  ) {}

  async getResults(roomId: string, sessionId?: string): Promise<GameResults> {
    const room = await this.prisma.gameRoom.findFirst({ where: { id: roomId, deletedAt: null } });
    if (!room) throw GameError.notFound('ROOM_NOT_FOUND', 'המשחק לא נמצא');
    const session = await this.resolveSession(room, sessionId);
    const [board, questionStats, achievements] = await Promise.all([
      this.leaderboard.compute(session.id),
      this.questionStats(session.id),
      this.prisma.studentAchievement.findMany({ where: { sessionId: session.id }, include: { achievement: { select: { type: true } } } }),
    ]);
    const entries = board.entries;
    const classAverage = entries.length > 0 ? Math.round(entries.reduce((s, e) => s + e.score, 0) / entries.length) : 0;
    const totalAnswered = entries.reduce((s, e) => s + e.answeredCount, 0);
    const totalCorrect = entries.reduce((s, e) => s + e.correctAnswers, 0);
    const hardestQuestions = [...questionStats]
      .filter((q) => q.answered > 0)
      .sort((a, b) => a.accuracy - b.accuracy || b.answered - a.answered || a.index - b.index)
      .slice(0, HARDEST_COUNT);
    return {
      roomId: room.id,
      gameSessionId: session.id,
      className: room.className,
      state: session.state,
      startedAt: session.startedAt?.toISOString() ?? null,
      finishedAt: session.finishedAt?.toISOString() ?? null,
      questionCount: questionStats.length,
      classAverage,
      classAccuracy: totalAnswered > 0 ? Math.round((totalCorrect / totalAnswered) * 100) : 0,
      leaderboard: entries,
      achievements: achievements.map((a) => ({ participantId: a.participantId, type: a.achievement.type as AchievementType })),
      questionStats,
      hardestQuestions,
    };
  }

  async exportResults(roomId: string, sessionId: string | undefined, format: ExportFormat): Promise<ExportFile> {
    const results = await this.getResults(roomId, sessionId);
    const room = await this.prisma.gameRoom.findUniqueOrThrow({ where: { id: roomId }, select: { code: true } });
    const session = await this.prisma.gameSession.findUniqueOrThrow({ where: { id: results.gameSessionId }, select: { roundNumber: true } });
    const base = `opposites-results-${room.code}-round${session.roundNumber}`;
    if (format === 'csv') {
      return { filename: `${base}.csv`, contentType: 'text/csv; charset=utf-8', body: Buffer.from(this.toCsv(results), 'utf8') };
    }
    return {
      filename: `${base}.xlsx`,
      contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      body: await this.toXlsx(results),
    };
  }

  // ===== עזר =====

  private async resolveSession(room: GameRoom, sessionId?: string): Promise<GameSession> {
    if (sessionId) {
      const s = await this.prisma.gameSession.findFirst({ where: { id: sessionId, roomId: room.id } });
      if (!s) throw GameError.notFound('SESSION_NOT_FOUND', 'הסבב לא נמצא');
      return s;
    }
    const current = room.currentSessionId ? await this.prisma.gameSession.findUnique({ where: { id: room.currentSessionId } }) : null;
    if (current) return current;
    const last = await this.prisma.gameSession.findFirst({ where: { roomId: room.id }, orderBy: { roundNumber: 'desc' } });
    if (!last) throw GameError.notFound('SESSION_NOT_FOUND', 'אין סבבים בחדר זה');
    return last;
  }

  private async questionStats(sessionId: string): Promise<QuestionStat[]> {
    const sqs = await this.prisma.sessionQuestion.findMany({
      where: { sessionId },
      orderBy: { index: 'asc' },
      include: { question: { include: { options: true } }, answers: { where: { participant: { removedAt: null } } } },
    });
    return sqs.map((sq) => {
      const answered = sq.answers.length;
      const correct = sq.answers.filter((a) => a.isCorrect).length;
      let distribution: QuestionStat['distribution'];
      if (sq.question.type === QuestionType.MATCH_PAIRS) {
        const total = parseQuestionPayload(sq.question.payload);
        const pairsCount = total.kind === 'match' ? total.pairs.length : 0;
        const buckets = new Map<number, number>();
        for (const a of sq.answers) {
          const payload = a.answerPayload;
          const matches = typeof payload === 'object' && payload !== null && !Array.isArray(payload) && Array.isArray(payload.matches) ? payload.matches.length : 0;
          const matched = a.isCorrect ? pairsCount : Math.min(matches, Math.max(0, pairsCount - 1));
          buckets.set(matched, (buckets.get(matched) ?? 0) + 1);
        }
        distribution = [...buckets.entries()].sort((x, y) => y[0] - x[0]).map(([matched, count]) => ({
          text: matched === pairsCount ? 'כל ההתאמות נכונות' : `${matched} מתוך ${pairsCount} התאמות`,
          count,
          isCorrect: matched === pairsCount,
        }));
      } else {
        const counts = new Map<string, number>();
        let skipped = 0;
        for (const a of sq.answers) {
          if (a.selectedOptionId) counts.set(a.selectedOptionId, (counts.get(a.selectedOptionId) ?? 0) + 1);
          else skipped += 1;
        }
        distribution = [...sq.question.options]
          .sort((a, b) => a.order - b.order)
          .map((o) => ({ text: o.text, count: counts.get(o.id) ?? 0, isCorrect: o.isCorrect }));
        if (skipped > 0) distribution.push({ text: 'ללא תשובה', count: skipped, isCorrect: false });
      }
      return {
        sessionQuestionId: sq.id,
        index: sq.index,
        type: sq.question.type,
        prompt: sq.question.prompt,
        correctAnswerText: this.questions.correctAnswerText(sq),
        answered,
        correct,
        accuracy: answered > 0 ? Math.round((correct / answered) * 100) : 0,
        distribution,
      };
    });
  }

  private toCsv(results: GameResults): string {
    const esc = (v: string | number): string => {
      const s = String(v);
      return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const lines: string[] = [];
    lines.push(['כיתה', results.className, 'ממוצע כיתתי', results.classAverage, 'דיוק כיתתי (%)', results.classAccuracy].map(esc).join(','));
    lines.push('');
    lines.push(LEADERBOARD_HEADERS.map(esc).join(','));
    for (const e of results.leaderboard) lines.push(leaderboardRow(e).map(esc).join(','));
    lines.push('');
    lines.push(QUESTION_HEADERS.map(esc).join(','));
    for (const q of results.questionStats) lines.push(questionRow(q).map(esc).join(','));
    return `﻿${lines.join('\r\n')}\r\n`;
  }

  private async toXlsx(results: GameResults): Promise<Buffer> {
    const wb = new ExcelJS.Workbook();
    wb.creator = 'אלופי ההפכים';
    const board = wb.addWorksheet('דירוג', { views: [{ rightToLeft: true }] });
    board.addRow(['כיתה', results.className, 'ממוצע כיתתי', results.classAverage, 'דיוק כיתתי (%)', results.classAccuracy]);
    board.addRow([]);
    const header = board.addRow(LEADERBOARD_HEADERS);
    header.font = { bold: true };
    for (const e of results.leaderboard) board.addRow(leaderboardRow(e));
    board.columns.forEach((c) => { c.width = 18; });

    const qs = wb.addWorksheet('שאלות', { views: [{ rightToLeft: true }] });
    const qHeader = qs.addRow(QUESTION_HEADERS);
    qHeader.font = { bold: true };
    for (const q of results.questionStats) qs.addRow(questionRow(q));
    qs.columns.forEach((c) => { c.width = 22; });

    const out = await wb.xlsx.writeBuffer();
    return Buffer.from(out as ArrayBuffer);
  }
}

const LEADERBOARD_HEADERS = ['דירוג', 'שם', 'ניקוד', 'תשובות נכונות', 'שאלות שנענו', 'דיוק (%)', 'זמן תגובה מצטבר (שניות)', 'סיים/ה'];
const QUESTION_HEADERS = ['מס׳', 'סוג', 'שאלה', 'תשובה נכונה', 'ענו', 'נכון', 'דיוק (%)', 'התפלגות תשובות'];

function leaderboardRow(e: LeaderboardEntry): Array<string | number> {
  return [e.rank, e.displayName, e.score, e.correctAnswers, e.answeredCount, e.accuracy, Math.round(e.totalResponseMs / 100) / 10, e.finished ? 'כן' : 'לא'];
}

function questionRow(q: QuestionStat): Array<string | number> {
  return [
    q.index + 1,
    QUESTION_TYPE_LABELS[q.type],
    q.prompt,
    q.correctAnswerText,
    q.answered,
    q.correct,
    q.accuracy,
    q.distribution.map((d) => `${d.text}: ${d.count}${d.isCorrect ? ' ✓' : ''}`).join(' | '),
  ];
}
