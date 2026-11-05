import { Injectable, Logger } from '@nestjs/common';
import type { Server } from 'socket.io';
import type { ClientToServerEvents, ServerToClientEvents, SocketData } from '@oc/shared';

export type InterServerEvents = Record<string, never>;
export type GameServer = Server<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>;

export const roomChannel = (roomId: string): string => `room:${roomId}`;
export const teacherChannel = (roomId: string): string => `teacher:${roomId}`;
export const participantChannel = (participantId: string): string => `participant:${participantId}`;

/**
 * אפיק אירועים מהשירותים אל ה־Gateway. ה־Gateway רושם את מופע השרת כאן,
 * וכך השירותים (משחק/ניקוד/דירוג) אינם תלויים ב־Gateway עצמו (ללא תלות מעגלית).
 */
@Injectable()
export class GameEventsService {
  private readonly logger = new Logger(GameEventsService.name);
  private server: GameServer | null = null;

  setServer(server: GameServer): void {
    this.server = server;
  }

  get isReady(): boolean {
    return this.server !== null;
  }

  toRoom<E extends keyof ServerToClientEvents>(roomId: string, event: E, ...args: Parameters<ServerToClientEvents[E]>): void {
    this.emitTo(roomChannel(roomId), event, ...args);
  }

  toParticipant<E extends keyof ServerToClientEvents>(participantId: string, event: E, ...args: Parameters<ServerToClientEvents[E]>): void {
    this.emitTo(participantChannel(participantId), event, ...args);
  }

  toTeacher<E extends keyof ServerToClientEvents>(roomId: string, event: E, ...args: Parameters<ServerToClientEvents[E]>): void {
    this.emitTo(teacherChannel(roomId), event, ...args);
  }

  /** מנתק את כל ה־sockets של משתתף (לאחר הסרה מהחדר) */
  disconnectParticipant(participantId: string): void {
    if (!this.server) return;
    this.server.in(participantChannel(participantId)).disconnectSockets(true);
  }

  /** מנתק את כל ה־sockets בחדר (מחיקת חדר) */
  disconnectRoom(roomId: string): void {
    if (!this.server) return;
    this.server.in(roomChannel(roomId)).disconnectSockets(true);
  }

  private emitTo<E extends keyof ServerToClientEvents>(channel: string, event: E, ...args: Parameters<ServerToClientEvents[E]>): void {
    if (!this.server) {
      this.logger.debug(`socket server not ready; dropping ${String(event)} → ${channel}`);
      return;
    }
    this.server.to(channel).emit(event, ...args);
  }
}
