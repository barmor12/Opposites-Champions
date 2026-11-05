import { Module } from '@nestjs/common';
import { QuestionsModule } from '../questions/questions.module';
import { PlayersController } from './players.controller';
import { PlayersService } from './players.service';
import { PlayerAuthGuard } from './player-auth.guard';

@Module({
  imports: [QuestionsModule],
  controllers: [PlayersController],
  providers: [PlayersService, PlayerAuthGuard],
  exports: [PlayersService],
})
export class PlayersModule {}
