import { Injectable } from '@nestjs/common';
import { GameMode, GameState, type GameSession, type ParticipantProgress, type StudentAnswer } from '@prisma/client';
import type { AchievementType, AnswerResult, AvatarId, PlayerSession, QuestionView } from '@oc/shared';
import { PrismaService } from '../prisma/prisma.service';
import { QuestionsService, SESSION_QUESTION_INCLUDE, type SessionQuestionFull } from '../questions/questions.service';
import { GameError } from '../games/game-error';
import { parseSettings } from '../games/settings';
import { toRoomPublicView } from '../rooms/room-views';

export interface PlayerProgressView {
  score: number;
  correctAnswers: number;
  answeredCount: number;
  finished: boolean;
  currentIndex: number;
  total: number;
  achievements: AchievementType[];
}

@Injectable()
export class PlayersService {
  constructor(private readonly prisma: PrismaService, private readonly questions: QuestionsService) {}

  /** מצב מלא של התלמיד – לשחזור אחרי רענון. השאלה הנוכחית נשלחת עם זמן ההתחלה המקורי. */
  async getSession(participantId: string): Promise<PlayerSession> {
    const participant = await this.prisma.gameParticipant.findFirst({
      where: { id: participantId, removedAt: null },
      include: { student: true, room: true },
    });
    if (!participant || participant.room.deletedAt) throw GameError.forbidden('NOT_IN_ROOM', 'אינך משתתף/ת בחדר זה');
    const room = participant.room;
    const session = room.currentSessionId ? await this.prisma.gameSession.findUnique({ where: { id: room.currentSessionId } }) : null;
    const [participantCount, progress, achievements] = await Promise.all([
      this.prisma.gameParticipant.count({ where: { roomId: room.id, removedAt: null } }),
      session ? this.prisma.participantProgress.findUnique({ where: { sessionId_participantId: { sessionId: session.id, participantId } } }) : null,
      this.prisma.studentAchievement.findMany({ where: { participantId }, include: { achievement: { select: { type: true } } } }),
    ]);

    let currentQuestion: QuestionView | null = null;
    let lastResult: AnswerResult | null = null;
    if (session && progress) {
      const total = await this.prisma.sessionQuestion.count({ where: { sessionId: session.id } });
      currentQuestion = await this.currentQuestion(session, progress, total);
      lastResult = await this.lastResult(session, progress, participantId);
    }

    return {
      participantId,
      displayName: participant.student.displayName,
      avatar: participant.student.avatar as AvatarId,
      room: toRoomPublicView(room, session, participantCount),
      gameSessionId: session?.id ?? null,
      score: progress?.score ?? 0,
      correctAnswers: progress?.correctAnswers ?? 0,
      answeredCount: progress?.answeredCount ?? 0,
      finished: progress?.finished ?? false,
      currentQuestion,
      lastResult,
      achievements: [...new Set(achievements.map((a) => a.achievement.type as AchievementType))],
    };
  }

  async getProgress(participantId: string): Promise<PlayerProgressView> {
    const participant = await this.prisma.gameParticipant.findFirst({ where: { id: participantId, removedAt: null }, include: { room: true } });
    if (!participant) throw GameError.forbidden('NOT_IN_ROOM', 'אינך משתתף/ת בחדר זה');
    const sessionId = participant.room.currentSessionId;
    const [progress, total, achievements] = await Promise.all([
      sessionId ? this.prisma.participantProgress.findUnique({ where: { sessionId_participantId: { sessionId, participantId } } }) : null,
      sessionId ? this.prisma.sessionQuestion.count({ where: { sessionId } }) : 0,
      this.prisma.studentAchievement.findMany({ where: { participantId }, include: { achievement: { select: { type: true } } } }),
    ]);
    return {
      score: progress?.score ?? 0,
      correctAnswers: progress?.correctAnswers ?? 0,
      answeredCount: progress?.answeredCount ?? 0,
      finished: progress?.finished ?? false,
      currentIndex: progress?.currentIndex ?? 0,
      total,
      achievements: [...new Set(achievements.map((a) => a.achievement.type as AchievementType))],
    };
  }

  private async currentQuestion(session: GameSession, progress: ParticipantProgress, total: number): Promise<QuestionView | null> {
    if (session.state !== GameState.QUESTION_ACTIVE && session.state !== GameState.PAUSED) return null;
    if (session.mode === GameMode.SELF_PACED) {
      if (progress.finished) return null;
      const sq = await this.questions.getSessionQuestion(session.id, progress.currentIndex);
      if (!sq) return null;
      return this.questions.toQuestionView(sq, progress.questionStartedAt ?? new Date(), total);
    }
    if (session.currentQuestionIndex === null) return null;
    const sq = await this.questions.getSessionQuestion(session.id, session.currentQuestionIndex);
    if (!sq || !sq.startedAt) return null;
    return this.questions.toQuestionView(sq, sq.startedAt, total);
  }

  private async lastResult(session: GameSession, progress: ParticipantProgress, participantId: string): Promise<AnswerResult | null> {
    const answer = await this.prisma.studentAnswer.findFirst({
      where: { sessionId: session.id, participantId },
      orderBy: { answeredAt: 'desc' },
      include: { sessionQuestion: { include: SESSION_QUESTION_INCLUDE } },
    });
    if (!answer) return null;
    return this.toAnswerResult(session, progress, answer, answer.sessionQuestion);
  }

  private toAnswerResult(session: GameSession, progress: ParticipantProgress, answer: StudentAnswer, sq: SessionQuestionFull): AnswerResult {
    const settings = parseSettings(session.settings);
    const reveal = settings.showCorrectAnswers && (session.mode === GameMode.SELF_PACED || sq.closedAt !== null);
    const info = reveal ? this.questions.correctInfo(sq) : {};
    return {
      sessionQuestionId: sq.id,
      correct: answer.isCorrect,
      scoreAwarded: answer.scoreAwarded,
      totalScore: progress.score,
      elapsedMs: answer.elapsedMs,
      streak: progress.streak,
      ...info,
    };
  }
}
