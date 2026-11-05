import { Module } from '@nestjs/common';
import { GameEventsService } from './game-events.service';

/** מודול קטן ונפרד כדי שכל שירות יוכל לשדר אירועים ללא תלות ב־Gateway */
@Module({ providers: [GameEventsService], exports: [GameEventsService] })
export class GameEventsModule {}
