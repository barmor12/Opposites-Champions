import { describe, expect, it } from 'vitest';
import { QuestionType, QUESTION_TYPE_DESCRIPTIONS, QUESTION_TYPE_LABELS } from '../enums';
import { EASY_PICTURE_PRESET, EASY_PICTURE_PRESET_LABEL, isPictureOnlySettings } from '../presets';

describe('QuestionType – PICTURE_TO_PICTURE', () => {
  it('exists with a Hebrew label and description', () => {
    expect(QuestionType.PICTURE_TO_PICTURE).toBe('PICTURE_TO_PICTURE');
    expect(QUESTION_TYPE_LABELS.PICTURE_TO_PICTURE).toBe('תמונה מול תמונה (ללא קריאה)');
    expect(QUESTION_TYPE_DESCRIPTIONS.PICTURE_TO_PICTURE).toContain('איורים בלבד');
  });

  it('every question type has a label and a non-empty description', () => {
    for (const t of Object.values(QuestionType)) {
      expect(QUESTION_TYPE_LABELS[t].length).toBeGreaterThan(0);
      expect(QUESTION_TYPE_DESCRIPTIONS[t].length).toBeGreaterThan(0);
    }
  });
});

describe('EASY_PICTURE_PRESET', () => {
  it('describes a no-reading, easy, untimed game without the treasure challenge', () => {
    expect(EASY_PICTURE_PRESET).toEqual({
      questionTypes: [QuestionType.PICTURE_TO_PICTURE],
      difficulty: 'EASY',
      timePerQuestionSec: 0,
      showCorrectAnswers: true,
      treasureChallenge: false,
    });
    expect(EASY_PICTURE_PRESET_LABEL).toBe('רמה קלה – תמונות בלבד');
  });

  it('isPictureOnlySettings is true only when every type is PICTURE_TO_PICTURE', () => {
    expect(isPictureOnlySettings({ questionTypes: [QuestionType.PICTURE_TO_PICTURE] })).toBe(true);
    expect(isPictureOnlySettings({ questionTypes: [QuestionType.PICTURE_TO_PICTURE, QuestionType.TREASURE_CHALLENGE] })).toBe(true);
    expect(isPictureOnlySettings({ questionTypes: [QuestionType.PICTURE_TO_PICTURE, QuestionType.CHOOSE_IMAGE] })).toBe(false);
    expect(isPictureOnlySettings({ questionTypes: [QuestionType.CHOOSE_OPPOSITE] })).toBe(false);
    expect(isPictureOnlySettings({ questionTypes: [] })).toBe(false);
  });
});
