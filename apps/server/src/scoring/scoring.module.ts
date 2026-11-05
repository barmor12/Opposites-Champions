import { Module } from '@nestjs/common';
import { GamesModule } from '../games/games.module';
import { LeaderboardModule } from '../leaderboard/leaderboard.module';
import { QuestionsModule } from '../questions/questions.module';
import { GameEventsModule } from '../websocket/game-events.module';
import { ScoringService } from './scoring.service';

@Module({
  imports: [QuestionsModule, LeaderboardModule, GameEventsModule, GamesModule],
  providers: [ScoringService],
  exports: [ScoringService],
})
export class ScoringModule {}
