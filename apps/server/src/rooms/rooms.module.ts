import { Module } from '@nestjs/common';
import { ThrottlerModule } from '@nestjs/throttler';
import { GameEventsModule } from '../websocket/game-events.module';
import { RoomsController } from './rooms.controller';
import { RoomsService } from './rooms.service';

@Module({
  imports: [
    GameEventsModule,
    // ThrottlerModule הוא Global; רישום כאן מבטיח שה־ThrottlerGuard יעבוד גם אם האפליקציה לא רשמה אותו
    ThrottlerModule.forRoot({ throttlers: [{ name: 'default', ttl: 60_000, limit: 20 }] }),
  ],
  controllers: [RoomsController],
  providers: [RoomsService],
  exports: [RoomsService],
})
export class RoomsModule {}
