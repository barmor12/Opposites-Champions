import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { Category, Difficulty, QuestionType } from '@oc/shared';
import { ContentService, toWordPairRecord } from './content.service';
import type { PrismaService } from '../prisma/prisma.service';
import { ListWordPairsQueryDto } from './dto/word-pair.dto';

const wordPair = {
  findMany: vi.fn(),
  count: vi.fn(),
  findUnique: vi.fn(),
  findFirst: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  groupBy: vi.fn(),
};
const mediaAsset = { findFirst: vi.fn(), findMany: vi.fn() };
const $transaction = vi.fn(async (ops: Promise<unknown>[]) => Promise.all(ops));
const prisma = { wordPair, mediaAsset, $transaction } as unknown as PrismaService;

const ROW_ID = '22222222-2222-4222-8222-222222222222';
const asset = (id: string, url: string, deletedAt: Date | null) => ({
  id,
  key: `pair:big-small:${id}`,
  kind: 'WORD_IMAGE' as const,
  url,
  alt: 'alt',
  width: null,
  height: null,
  createdAt: new Date(),
  deletedAt,
});
const baseRow = {
  id: ROW_ID,
  slug: 'big-small',
  word: 'גדול',
  opposite: 'קטן',
  category: Category.SIZES as 'SIZES',
  difficulty: Difficulty.EASY as 'EASY',
  sentence: 'הפיל ____ והעכבר קטן',
  sentenceAnswer: 'word',
  explanation: null,
  imageable: true,
  wordImageId: 'a',
  oppositeImageId: 'b',
  supportedTypes: [QuestionType.CHOOSE_OPPOSITE, QuestionType.CHOOSE_IMAGE] as Array<'CHOOSE_OPPOSITE' | 'CHOOSE_IMAGE'>,
  active: true,
  createdAt: new Date(),
  updatedAt: new Date(),
  deletedAt: null,
  wordImage: asset('a', '/img/big.png', null),
  oppositeImage: asset('b', '/img/small.png', new Date()),
};

describe('ContentService', () => {
  let service: ContentService;

  beforeEach(() => {
    for (const fn of [...Object.values(wordPair), ...Object.values(mediaAsset)]) fn.mockReset();
    $transaction.mockClear();
    service = new ContentService(prisma);
  });

  it('maps rows to WordPairContent with id=uuid, slug and resolved image urls (ignoring deleted assets)', () => {
    const record = toWordPairRecord(baseRow);
    expect(record.id).toBe(ROW_ID);
    expect(record.slug).toBe('big-small');
    expect(record.wordImage).toBe('/img/big.png');
    expect(record.oppositeImage).toBeUndefined();
    expect(record.explanation).toBeUndefined();
    expect(record.sentenceAnswer).toBe('word');
  });

  it('lists with search on word/opposite, filters and pagination', async () => {
    wordPair.findMany.mockResolvedValue([baseRow]);
    wordPair.count.mockResolvedValue(1);
    const query = Object.assign(new ListWordPairsQueryDto(), { search: 'גד', category: Category.SIZES, page: 2, limit: 10 });
    const result = await service.list(query);
    expect(result.total).toBe(1);
    expect(result.items[0]?.word).toBe('גדול');
    const args = wordPair.findMany.mock.calls[0]?.[0] as { where: Record<string, unknown>; skip: number; take: number };
    expect(args.skip).toBe(10);
    expect(args.take).toBe(10);
    expect(args.where.deletedAt).toBeNull();
    expect(args.where.category).toBe(Category.SIZES);
    expect(args.where.OR).toEqual([
      { word: { contains: 'גד', mode: 'insensitive' } },
      { opposite: { contains: 'גד', mode: 'insensitive' } },
    ]);
  });

  it('rejects creating a pair whose slug already exists', async () => {
    wordPair.findUnique.mockResolvedValue({ id: 'x' });
    await expect(
      service.create({
        slug: 'big-small',
        word: 'גדול',
        opposite: 'קטן',
        category: Category.SIZES,
        difficulty: Difficulty.EASY,
        sentence: 's',
        sentenceAnswer: 'opposite',
        imageable: false,
        supportedTypes: [QuestionType.CHOOSE_OPPOSITE],
      }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(wordPair.create).not.toHaveBeenCalled();
  });

  it('links media by key on create and rejects unknown media', async () => {
    wordPair.findUnique.mockResolvedValue(null);
    mediaAsset.findFirst.mockResolvedValueOnce({ id: 'media-1' }).mockResolvedValueOnce(null);
    wordPair.create.mockResolvedValue(baseRow);
    const dto = {
      word: 'גדול',
      opposite: 'קטן',
      category: Category.SIZES,
      difficulty: Difficulty.EASY,
      sentence: 's',
      sentenceAnswer: 'word' as const,
      imageable: true,
      wordImage: 'pair:big-small:word',
      supportedTypes: [QuestionType.CHOOSE_OPPOSITE],
    };
    const created = await service.create(dto);
    expect(created.slug).toBe('big-small');
    const createArgs = wordPair.create.mock.calls[0]?.[0] as { data: { wordImageId: string | null; slug: string; active: boolean } };
    expect(createArgs.data.wordImageId).toBe('media-1');
    expect(createArgs.data.slug).toMatch(/^custom-[0-9a-f]{8}$/);
    expect(createArgs.data.active).toBe(true);

    await expect(service.create({ ...dto, wordImage: 'pair:missing:word' })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('soft deletes by setting deletedAt and 404s for unknown ids', async () => {
    wordPair.findFirst.mockResolvedValueOnce(baseRow);
    wordPair.update.mockResolvedValue(baseRow);
    await expect(service.softDelete(ROW_ID)).resolves.toEqual({ ok: true });
    const updateArgs = wordPair.update.mock.calls[0]?.[0] as { where: { id: string }; data: { deletedAt: Date; active: boolean } };
    expect(updateArgs.where.id).toBe(ROW_ID);
    expect(updateArgs.data.deletedAt).toBeInstanceOf(Date);
    expect(updateArgs.data.active).toBe(false);

    wordPair.findFirst.mockResolvedValueOnce(null);
    await expect(service.softDelete('nope')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('getPlayablePairs filters active/non-deleted pairs by categories, difficulty and types', async () => {
    wordPair.findMany.mockResolvedValue([baseRow]);
    const pairs = await service.getPlayablePairs({
      categories: [Category.SIZES, Category.EMOTIONS],
      difficulty: 'MIXED',
      types: [QuestionType.CHOOSE_IMAGE, QuestionType.TREASURE_CHALLENGE],
      requireImages: true,
    });
    expect(pairs).toHaveLength(1);
    expect(pairs[0]?.wordImage?.url).toBe('/img/big.png');
    expect(pairs[0]?.oppositeImage).toBeNull();
    const args = wordPair.findMany.mock.calls[0]?.[0] as { where: Record<string, unknown> };
    expect(args.where.active).toBe(true);
    expect(args.where.deletedAt).toBeNull();
    expect(args.where.category).toEqual({ in: [Category.SIZES, Category.EMOTIONS] });
    expect(args.where.difficulty).toBeUndefined();
    expect(args.where.supportedTypes).toEqual({ hasSome: [QuestionType.CHOOSE_IMAGE] });
    expect(args.where.imageable).toBe(true);

    await service.getPlayablePairs({ difficulty: Difficulty.HARD });
    const args2 = wordPair.findMany.mock.calls[1]?.[0] as { where: Record<string, unknown> };
    expect(args2.where.difficulty).toBe(Difficulty.HARD);
  });

  it('returns every category with a label and count', async () => {
    wordPair.groupBy.mockResolvedValue([{ category: Category.SIZES, _count: { _all: 3 } }]);
    const cats = await service.categories();
    expect(cats).toHaveLength(Object.values(Category).length);
    expect(cats.find((c) => c.id === Category.SIZES)).toEqual({ id: Category.SIZES, label: 'גדלים ומידות', count: 3 });
    expect(cats.find((c) => c.id === Category.EMOTIONS)?.count).toBe(0);
  });
});
