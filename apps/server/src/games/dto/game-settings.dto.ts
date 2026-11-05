import { ArrayMinSize, ArrayUnique, IsArray, IsBoolean, IsIn, IsString, Length } from 'class-validator';
import {
  Category, GameMode, QuestionType, QUESTION_COUNT_OPTIONS, TIME_PER_QUESTION_OPTIONS,
  type DifficultySetting, type GameSettings,
} from '@oc/shared';

const DIFFICULTIES: readonly DifficultySetting[] = ['EASY', 'MEDIUM', 'HARD', 'MIXED'];

export class GameSettingsDto implements GameSettings {
  @IsString({ message: 'יש להזין שם כיתה' })
  @Length(1, 60, { message: 'שם הכיתה חייב להכיל 1 עד 60 תווים' })
  className!: string;

  @IsIn(QUESTION_COUNT_OPTIONS, { message: 'מספר השאלות חייב להיות 10, 12, 15 או 20' })
  questionCount!: number;

  @IsIn(DIFFICULTIES, { message: 'רמת קושי לא תקינה' })
  difficulty!: DifficultySetting;

  @IsArray({ message: 'יש לבחור קטגוריות' })
  @ArrayMinSize(1, { message: 'יש לבחור לפחות קטגוריה אחת' })
  @ArrayUnique()
  @IsIn(Object.values(Category), { each: true, message: 'קטגוריה לא תקינה' })
  categories!: Category[];

  @IsIn(TIME_PER_QUESTION_OPTIONS, { message: 'זמן לשאלה חייב להיות 15, 20, 30 או ללא הגבלה' })
  timePerQuestionSec!: number;

  @IsArray({ message: 'יש לבחור סוגי שאלות' })
  @ArrayMinSize(1, { message: 'יש לבחור לפחות סוג שאלה אחד' })
  @ArrayUnique()
  @IsIn(Object.values(QuestionType), { each: true, message: 'סוג שאלה לא תקין' })
  questionTypes!: QuestionType[];

  @IsIn(Object.values(GameMode), { message: 'מצב משחק לא תקין' })
  mode!: GameMode;

  @IsBoolean() competitionEnabled!: boolean;
  @IsBoolean() showLeaderboard!: boolean;
  @IsBoolean() showCorrectAnswers!: boolean;
  @IsBoolean() soundsEnabled!: boolean;
  @IsBoolean() treasureChallenge!: boolean;
}

export class JoinOpenDto {
  @IsBoolean({ message: 'יש לציין האם ההצטרפות פתוחה' })
  open!: boolean;
}
