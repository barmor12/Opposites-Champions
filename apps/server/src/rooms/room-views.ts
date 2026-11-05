import type { GameRoom, GameSession, GameParticipant, ParticipantProgress, Student } from '@prisma/client';
import type { AvatarId, GameSummary, ParticipantView, RoomPublicView } from '@oc/shared';
import { parseSettings } from '../games/settings';

export type ParticipantWithStudent = GameParticipant & { student: Student };

/** תצוגה ציבורית של חדר – ללא שמות תלמידים */
export function toRoomPublicView(room: GameRoom, session: GameSession | null, participantCount: number): RoomPublicView {
  const settings = parseSettings(session?.settings ?? room.settings);
  return {
    roomId: room.id,
    code: room.code,
    className: room.className,
    state: room.state,
    joinOpen: room.joinOpen,
    mode: room.mode,
    participantCount,
    questionCount: settings.questionCount,
    currentQuestionIndex: session?.currentQuestionIndex ?? null,
    settings: {
      timePerQuestionSec: settings.timePerQuestionSec,
      showLeaderboard: settings.showLeaderboard,
      showCorrectAnswers: settings.showCorrectAnswers,
      soundsEnabled: settings.soundsEnabled,
      competitionEnabled: settings.competitionEnabled,
    },
  };
}

export function toParticipantView(p: ParticipantWithStudent, progress: ParticipantProgress | null | undefined): ParticipantView {
  return {
    id: p.id,
    displayName: p.student.displayName,
    avatar: p.student.avatar as AvatarId,
    connected: p.connected,
    finished: progress?.finished ?? false,
    answeredCount: progress?.answeredCount ?? 0,
    score: progress?.score ?? 0,
  };
}

export function toGameSummary(room: GameRoom, participantCount: number, sessionCount: number): GameSummary {
  return {
    roomId: room.id,
    code: room.code,
    className: room.className,
    state: room.state,
    joinOpen: room.joinOpen,
    mode: room.mode,
    createdAt: room.createdAt.toISOString(),
    participantCount,
    sessionCount,
    currentSessionId: room.currentSessionId,
    settings: parseSettings(room.settings),
  };
}
