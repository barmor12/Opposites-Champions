import { Module } from '@nestjs/common';
import { ContentModule } from '../content/content.module';
import { QuestionsService } from './questions.service';

@Module({ imports: [ContentModule], providers: [QuestionsService], exports: [QuestionsService] })
export class QuestionsModule {}
