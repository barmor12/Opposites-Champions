import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { PlayerContext, RequestWithPlayer } from './player-auth.guard';

export const CurrentPlayer = createParamDecorator((_data: unknown, ctx: ExecutionContext): PlayerContext => {
  const req = ctx.switchToHttp().getRequest<RequestWithPlayer>();
  if (!req.player) throw new Error('CurrentPlayer used without PlayerAuthGuard');
  return req.player;
});
