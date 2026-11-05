import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { Category, Difficulty, QuestionType } from '@oc/shared';

const CATEGORIES = Object.values(Category);
const DIFFICULTIES = Object.values(Difficulty);
const QUESTION_TYPES = Object.values(QuestionType);
const SENTENCE_ANSWERS = ['word', 'opposite'] as const;

const trim = ({ value }: { value: unknown }): unknown => (typeof value === 'string' ? value.trim() : value);
/** Accepts '' / null as "unlink image"; keeps undefined as "no change". */
const nullableTrim = ({ value }: { value: unknown }): unknown => {
  if (value === null || value === '') return null;
  return typeof value === 'string' ? value.trim() : value;
};

export class CreateWordPairDto {
  @IsOptional()
  @Transform(trim)
  @IsString({ message: 'מזהה (slug) חייב להיות טקסט' })
  @Matches(/^[a-z0-9][a-z0-9_-]{1,62}$/, { message: 'מזהה (slug) יכול להכיל אותיות לטיניות קטנות, ספרות, מקף וקו תחתון בלבד' })
  slug?: string;

  @Transform(trim)
  @IsString({ message: 'יש להזין מילה' })
  @MinLength(1, { message: 'יש להזין מילה' })
  @MaxLength(60, { message: 'המילה ארוכה מדי' })
  word!: string;

  @Transform(trim)
  @IsString({ message: 'יש להזין את המילה ההפוכה' })
  @MinLength(1, { message: 'יש להזין את המילה ההפוכה' })
  @MaxLength(60, { message: 'המילה ההפוכה ארוכה מדי' })
  opposite!: string;

  @IsEnum(Category, { message: 'קטגוריה לא תקינה' })
  category!: Category;

  @IsEnum(Difficulty, { message: 'רמת קושי לא תקינה' })
  difficulty!: Difficulty;

  @Transform(trim)
  @IsString({ message: 'יש להזין משפט דוגמה' })
  @MinLength(1, { message: 'יש להזין משפט דוגמה' })
  @MaxLength(300, { message: 'משפט הדוגמה ארוך מדי' })
  sentence!: string;

  @IsIn(SENTENCE_ANSWERS, { message: 'תשובת המשפט חייבת להיות word או opposite' })
  sentenceAnswer!: 'word' | 'opposite';

  @IsOptional()
  @Transform(nullableTrim)
  @IsString({ message: 'ההסבר חייב להיות טקסט' })
  @MaxLength(500, { message: 'ההסבר ארוך מדי' })
  explanation?: string | null;

  @IsBoolean({ message: 'שדה imageable חייב להיות כן/לא' })
  imageable!: boolean;

  /** MediaAsset key (e.g. `pair:big:word`) or its URL; empty/null unlinks. */
  @IsOptional()
  @Transform(nullableTrim)
  @IsString({ message: 'תמונת המילה חייבת להיות מפתח מדיה או כתובת' })
  @MaxLength(500)
  wordImage?: string | null;

  @IsOptional()
  @Transform(nullableTrim)
  @IsString({ message: 'תמונת ההפך חייבת להיות מפתח מדיה או כתובת' })
  @MaxLength(500)
  oppositeImage?: string | null;

  @IsArray({ message: 'סוגי השאלות חייבים להיות רשימה' })
  @ArrayMinSize(1, { message: 'יש לבחור לפחות סוג שאלה אחד' })
  @ArrayMaxSize(QUESTION_TYPES.length)
  @ArrayUnique({ message: 'סוגי השאלות חייבים להיות ייחודיים' })
  @IsEnum(QuestionType, { each: true, message: 'סוג שאלה לא תקין' })
  supportedTypes!: QuestionType[];

  @IsOptional()
  @IsBoolean({ message: 'שדה active חייב להיות כן/לא' })
  active?: boolean;
}

export class UpdateWordPairDto {
  @IsOptional()
  @Transform(trim)
  @IsString({ message: 'מזהה (slug) חייב להיות טקסט' })
  @Matches(/^[a-z0-9][a-z0-9_-]{1,62}$/, { message: 'מזהה (slug) יכול להכיל אותיות לטיניות קטנות, ספרות, מקף וקו תחתון בלבד' })
  slug?: string;

  @IsOptional()
  @Transform(trim)
  @IsString({ message: 'יש להזין מילה' })
  @MinLength(1, { message: 'יש להזין מילה' })
  @MaxLength(60, { message: 'המילה ארוכה מדי' })
  word?: string;

  @IsOptional()
  @Transform(trim)
  @IsString({ message: 'יש להזין את המילה ההפוכה' })
  @MinLength(1, { message: 'יש להזין את המילה ההפוכה' })
  @MaxLength(60, { message: 'המילה ההפוכה ארוכה מדי' })
  opposite?: string;

  @IsOptional()
  @IsEnum(Category, { message: 'קטגוריה לא תקינה' })
  category?: Category;

  @IsOptional()
  @IsEnum(Difficulty, { message: 'רמת קושי לא תקינה' })
  difficulty?: Difficulty;

  @IsOptional()
  @Transform(trim)
  @IsString({ message: 'יש להזין משפט דוגמה' })
  @MinLength(1, { message: 'יש להזין משפט דוגמה' })
  @MaxLength(300, { message: 'משפט הדוגמה ארוך מדי' })
  sentence?: string;

  @IsOptional()
  @IsIn(SENTENCE_ANSWERS, { message: 'תשובת המשפט חייבת להיות word או opposite' })
  sentenceAnswer?: 'word' | 'opposite';

  @IsOptional()
  @Transform(nullableTrim)
  @IsString({ message: 'ההסבר חייב להיות טקסט' })
  @MaxLength(500, { message: 'ההסבר ארוך מדי' })
  explanation?: string | null;

  @IsOptional()
  @IsBoolean({ message: 'שדה imageable חייב להיות כן/לא' })
  imageable?: boolean;

  @IsOptional()
  @Transform(nullableTrim)
  @IsString({ message: 'תמונת המילה חייבת להיות מפתח מדיה או כתובת' })
  @MaxLength(500)
  wordImage?: string | null;

  @IsOptional()
  @Transform(nullableTrim)
  @IsString({ message: 'תמונת ההפך חייבת להיות מפתח מדיה או כתובת' })
  @MaxLength(500)
  oppositeImage?: string | null;

  @IsOptional()
  @IsArray({ message: 'סוגי השאלות חייבים להיות רשימה' })
  @ArrayMinSize(1, { message: 'יש לבחור לפחות סוג שאלה אחד' })
  @ArrayMaxSize(QUESTION_TYPES.length)
  @ArrayUnique({ message: 'סוגי השאלות חייבים להיות ייחודיים' })
  @IsEnum(QuestionType, { each: true, message: 'סוג שאלה לא תקין' })
  supportedTypes?: QuestionType[];

  @IsOptional()
  @IsBoolean({ message: 'שדה active חייב להיות כן/לא' })
  active?: boolean;
}

export class ListWordPairsQueryDto {
  @IsOptional()
  @IsIn(CATEGORIES, { message: 'קטגוריה לא תקינה' })
  category?: Category;

  @IsOptional()
  @IsIn(DIFFICULTIES, { message: 'רמת קושי לא תקינה' })
  difficulty?: Difficulty;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(60, { message: 'מונח החיפוש ארוך מדי' })
  search?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'מספר העמוד חייב להיות מספר שלם' })
  @Min(1, { message: 'מספר העמוד חייב להיות לפחות 1' })
  page: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'גודל העמוד חייב להיות מספר שלם' })
  @Min(1, { message: 'גודל העמוד חייב להיות לפחות 1' })
  @Max(200, { message: 'גודל העמוד המרבי הוא 200' })
  limit: number = 50;

  /** Include inactive pairs (default: all non-deleted pairs are listed). */
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true || value === '1')
  @IsBoolean()
  activeOnly?: boolean;
}
