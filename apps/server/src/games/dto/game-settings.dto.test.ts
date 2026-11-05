import { describe, expect, it } from 'vitest';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { Category, EASY_PICTURE_PRESET, GameMode, QuestionType, type GameSettings } from '@oc/shared';
import { GameSettingsDto } from './game-settings.dto';
import { parseSettings } from '../settings';

const BASE: GameSettings = {
  className: 'ג1',
  questionCount: 10,
  difficulty: 'MIXED',
  categories: Object.values(Category),
  timePerQuestionSec: 20,
  questionTypes: [QuestionType.CHOOSE_OPPOSITE],
  mode: GameMode.SELF_PACED,
  competitionEnabled: true,
  showLeaderboard: true,
  showCorrectAnswers: true,
  soundsEnabled: true,
  treasureChallenge: false,
};

async function errorsOf(body: unknown): Promise<string[]> {
  const errors = await validate(plainToInstance(GameSettingsDto, body), { whitelist: true, forbidNonWhitelisted: true });
  return errors.map((e) => e.property);
}

describe('GameSettingsDto', () => {
  it('accepts PICTURE_TO_PICTURE as a question type', async () => {
    expect(await errorsOf({ ...BASE, questionTypes: [QuestionType.PICTURE_TO_PICTURE] })).toEqual([]);
    expect(await errorsOf({ ...BASE, questionTypes: [QuestionType.CHOOSE_IMAGE, QuestionType.PICTURE_TO_PICTURE] })).toEqual([]);
  });

  it('accepts the easy picture preset merged into full settings', async () => {
    expect(await errorsOf({ ...BASE, ...EASY_PICTURE_PRESET })).toEqual([]);
  });

  it('still rejects unknown question types and empty lists', async () => {
    expect(await errorsOf({ ...BASE, questionTypes: ['PICTURE_ONLY'] })).toEqual(['questionTypes']);
    expect(await errorsOf({ ...BASE, questionTypes: [] })).toEqual(['questionTypes']);
  });
});

describe('parseSettings', () => {
  it('keeps PICTURE_TO_PICTURE when reading stored settings', () => {
    const parsed = parseSettings({ ...BASE, ...EASY_PICTURE_PRESET });
    expect(parsed.questionTypes).toEqual([QuestionType.PICTURE_TO_PICTURE]);
    expect(parsed.difficulty).toBe('EASY');
    expect(parsed.timePerQuestionSec).toBe(0);
    expect(parsed.treasureChallenge).toBe(false);
  });
});
