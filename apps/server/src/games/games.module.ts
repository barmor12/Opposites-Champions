import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { QuestionsModule } from '../questions/questions.module';
import { LeaderboardModule } from '../leaderboard/leaderboard.module';
import { RoomsModule } from '../rooms/rooms.module';
import { GameEventsModule } from '../websocket/game-events.module';
import { GamesController } from './games.controller';
import { GamesService } from './games.service';
import { TimerRegistry } from './timer-registry';

@Module({
  imports: [AuthModule, QuestionsModule, LeaderboardModule, RoomsModule, GameEventsModule],
  controllers: [GamesController],
  providers: [GamesService, TimerRegistry],
  exports: [GamesService, TimerRegistry],
})
export class GamesModule {}
