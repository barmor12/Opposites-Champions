import { Controller, Get, UseGuards } from '@nestjs/common';
import type { PlayerSession } from '@oc/shared';
import { PlayerAuthGuard, type PlayerContext } from './player-auth.guard';
import { CurrentPlayer } from './current-player.decorator';
import { PlayersService, type PlayerProgressView } from './players.service';

@Controller('player')
@UseGuards(PlayerAuthGuard)
export class PlayersController {
  constructor(private readonly players: PlayersService) {}

  @Get('session')
  session(@CurrentPlayer() player: PlayerContext): Promise<PlayerSession> {
    return this.players.getSession(player.participantId);
  }

  @Get('progress')
  progress(@CurrentPlayer() player: PlayerContext): Promise<PlayerProgressView> {
    return this.players.getProgress(player.participantId);
  }
}
