import { type CanActivate, type ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import type { Request } from 'express';
import { SESSION_TOKEN_HEADER } from '@oc/shared';
import { PrismaService } from '../prisma/prisma.service';
import { hashSessionToken, isSessionTokenFormat } from './player-token';

export interface PlayerContext { participantId: string; roomId: string; studentId: string }
export type RequestWithPlayer = Request & { player?: PlayerContext };

/** מאמת session token של תלמיד (header x-player-token) ומצמיד את המשתתף לבקשה */
@Injectable()
export class PlayerAuthGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest<RequestWithPlayer>();
    const token = req.header(SESSION_TOKEN_HEADER);
    // Syntactic check first (length + base64url alphabet) – garbage never reaches the hash lookup.
    if (!isSessionTokenFormat(token)) throw new UnauthorizedException('אין הרשאה');
    const participant = await this.prisma.gameParticipant.findFirst({
      where: { sessionTokenHash: hashSessionToken(token), removedAt: null },
      select: { id: true, roomId: true, studentId: true },
    });
    if (!participant) throw new UnauthorizedException('ההתחברות לא נמצאה, הצטרפו מחדש');
    req.player = { participantId: participant.id, roomId: participant.roomId, studentId: participant.studentId };
    return true;
  }
}
