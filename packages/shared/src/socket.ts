import type {
  AnswerPayload, AnswerResult, Leaderboard, ParticipantView, QuestionView, RoomPublicView,
  AchievementAward,
} from './types';

/** אירועים מהשרת ללקוח */
export interface ServerToClientEvents {
  'player:connected': (p: { participantId: string; displayName: string; participantCount: number }) => void;
  'player:disconnected': (p: { participantId: string; participantCount: number }) => void;
  'player:removed': (p: { participantId: string; reason: string }) => void;
  'room:updated': (p: { room: RoomPublicView; participants: ParticipantView[] }) => void;
  'game:countdown': (p: { seconds: number; startsAt: number; serverNow: number }) => void;
  'game:started': (p: { gameSessionId: string; mode: RoomPublicView['mode']; questionCount: number }) => void;
  'question:started': (p: QuestionView) => void;
  'question:ended': (p: { sessionQuestionId: string; correctOptionId?: string; correctMatches?: Array<{ cardA: string; cardB: string }>; explanation?: string }) => void;
  'answer:result': (p: AnswerResult) => void;
  'leaderboard:updated': (p: Leaderboard) => void;
  'achievement:awarded': (p: AchievementAward[]) => void;
  'game:paused': (p: { serverNow: number }) => void;
  'game:resumed': (p: { serverNow: number; question?: QuestionView }) => void;
  'game:finished': (p: { gameSessionId: string; leaderboard: Leaderboard }) => void;
  'player:finished': (p: { participantId: string; finishedCount: number; participantCount: number }) => void;
  'error:message': (p: { code: string; message: string }) => void;
}

/** אירועים מהלקוח לשרת */
export interface ClientToServerEvents {
  'player:join': (p: { sessionToken: string }, ack: (r: SocketAck<{ ok: true }>) => void) => void;
  'answer:submit': (p: AnswerPayload, ack: (r: SocketAck<AnswerResult>) => void) => void;
  'question:next': (p: { sessionQuestionId: string }, ack: (r: SocketAck<{ question: QuestionView | null; finished: boolean }>) => void) => void;
  'time:ping': (clientSentAt: number, ack: (serverNow: number) => void) => void;
  'teacher:join': (p: { roomId: string }, ack: (r: SocketAck<{ ok: true }>) => void) => void;
}

export type SocketAck<T> = { ok: true; data: T } | { ok: false; error: { code: string; message: string } };

export interface SocketData {
  role: 'player' | 'teacher';
  participantId?: string;
  roomId?: string;
  teacherId?: string;
}
