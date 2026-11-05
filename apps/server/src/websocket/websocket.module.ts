import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { RoomsModule } from '../rooms/rooms.module';
import { ScoringModule } from '../scoring/scoring.module';
import { GameEventsModule } from './game-events.module';
import { GameGateway } from './game.gateway';

@Module({
  imports: [AuthModule, GameEventsModule, RoomsModule, ScoringModule],
  providers: [GameGateway],
  exports: [GameEventsModule],
})
export class WebsocketModule {}
