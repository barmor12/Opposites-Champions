import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { ContentModule } from '../content/content.module';
import { RoomsModule } from '../rooms/rooms.module';
import { GamesModule } from './games.module';
import { PlayersModule } from '../players/players.module';
import { QuestionsModule } from '../questions/questions.module';
import { ScoringModule } from '../scoring/scoring.module';
import { LeaderboardModule } from '../leaderboard/leaderboard.module';
import { WebsocketModule } from '../websocket/websocket.module';
import { ReportsModule } from '../reports/reports.module';

/** מאגד את כל מודולי מנוע המשחק – מיובא פעם אחת ב־AppModule */
@Module({
  imports: [
    AuthModule, ContentModule,
    RoomsModule, GamesModule, PlayersModule, QuestionsModule, ScoringModule, LeaderboardModule, WebsocketModule, ReportsModule,
  ],
  exports: [RoomsModule, GamesModule, PlayersModule, QuestionsModule, ScoringModule, LeaderboardModule, WebsocketModule, ReportsModule],
})
export class GameFeatureModule {}
