import { Module } from '@nestjs/common';
import { GameEventsModule } from '../websocket/game-events.module';
import { LeaderboardService } from './leaderboard.service';

@Module({ imports: [GameEventsModule], providers: [LeaderboardService], exports: [LeaderboardService] })
export class LeaderboardModule {}
