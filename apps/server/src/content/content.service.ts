import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import type { Prisma } from '@prisma/client';
import { Category, CATEGORY_LABELS, type Difficulty, QuestionType, stripNikud } from '@oc/shared';
import { PrismaService } from '../prisma/prisma.service';
import { HE } from '../common/hebrew-messages';
import type { CreateWordPairDto, ListWordPairsQueryDto, UpdateWordPairDto } from './dto/word-pair.dto';
import type { CategorySummary, MediaAssetView, PlayablePairFilter, WordPairListResult, WordPairRecord } from './content.types';

const WORD_PAIR_INCLUDE = { wordImage: true, oppositeImage: true } satisfies Prisma.WordPairInclude;

/** WordPair row with both MediaAsset relations loaded (soft-deleted assets are nulled out). */
export type PlayableWordPair = Prisma.WordPairGetPayload<{ include: { wordImage: true; oppositeImage: true } }>;
type WordPairRow = PlayableWordPair;

type ImageRow = { url: string; deletedAt: Date | null } | null;

function imageUrl(img: ImageRow): string | undefined {
  return img && !img.deletedAt ? img.url : undefined;
}

export function toWordPairRecord(row: WordPairRow): WordPairRecord {
  const sentenceAnswer: WordPairRecord['sentenceAnswer'] = row.sentenceAnswer === 'word' ? 'word' : 'opposite';
  const record: WordPairRecord = {
    id: row.id,
    slug: row.slug,
    word: row.word,
    opposite: row.opposite,
    category: row.category,
    difficulty: row.difficulty,
    sentence: row.sentence,
    sentenceAnswer,
    imageable: row.imageable,
    supportedTypes: row.supportedTypes,
    active: row.active,
  };
  if (row.explanation) record.explanation = row.explanation;
  const wordImage = imageUrl(row.wordImage);
  const oppositeImage = imageUrl(row.oppositeImage);
  if (wordImage) record.wordImage = wordImage;
  if (oppositeImage) record.oppositeImage = oppositeImage;
  return record;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

@Injectable()
export class ContentService {
  constructor(private readonly prisma: PrismaService) {}

  async list(query: ListWordPairsQueryDto): Promise<WordPairListResult> {
    const where: Prisma.WordPairWhereInput = { deletedAt: null };
    if (query.category) where.category = query.category;
    if (query.difficulty) where.difficulty = query.difficulty;
    if (query.activeOnly) where.active = true;
    const page = query.page ?? 1;
    const limit = query.limit ?? 50;
    const search = query.search ? stripNikud(query.search).trim().toLowerCase() : '';
    if (search) {
      // המילים במאגר מנוקדות – חיפוש ללא תלות בניקוד נעשה בזיכרון (המאגר קטן: מאות זוגות)
      const all = await this.prisma.wordPair.findMany({
        where,
        include: WORD_PAIR_INCLUDE,
        orderBy: [{ category: 'asc' }, { difficulty: 'asc' }, { word: 'asc' }],
      });
      const matches = all.filter((r) => stripNikud(r.word).toLowerCase().includes(search) || stripNikud(r.opposite).toLowerCase().includes(search));
      return { items: matches.slice((page - 1) * limit, page * limit).map(toWordPairRecord), total: matches.length };
    }
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.wordPair.findMany({
        where,
        include: WORD_PAIR_INCLUDE,
        orderBy: [{ category: 'asc' }, { difficulty: 'asc' }, { word: 'asc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.wordPair.count({ where }),
    ]);
    return { items: rows.map(toWordPairRecord), total };
  }

  async getById(id: string): Promise<WordPairRecord> {
    const row = await this.findActiveRow(id);
    return toWordPairRecord(row);
  }

  async create(dto: CreateWordPairDto): Promise<WordPairRecord> {
    const slug = dto.slug ?? generateSlug();
    const existing = await this.prisma.wordPair.findUnique({ where: { slug }, select: { id: true } });
    if (existing) throw new ConflictException(HE.wordPairSlugExists);

    const wordImageId = await this.resolveMediaId(dto.wordImage);
    const oppositeImageId = await this.resolveMediaId(dto.oppositeImage);

    const row = await this.prisma.wordPair.create({
      data: {
        slug,
        word: dto.word,
        opposite: dto.opposite,
        category: dto.category,
        difficulty: dto.difficulty,
        sentence: dto.sentence,
        sentenceAnswer: dto.sentenceAnswer,
        explanation: dto.explanation ?? null,
        imageable: dto.imageable,
        wordImageId: wordImageId ?? null,
        oppositeImageId: oppositeImageId ?? null,
        supportedTypes: dto.supportedTypes,
        active: dto.active ?? true,
      },
      include: WORD_PAIR_INCLUDE,
    });
    return toWordPairRecord(row);
  }

  async update(id: string, dto: UpdateWordPairDto): Promise<WordPairRecord> {
    const current = await this.findActiveRow(id);
    if (dto.slug && dto.slug !== current.slug) {
      const clash = await this.prisma.wordPair.findUnique({ where: { slug: dto.slug }, select: { id: true } });
      if (clash) throw new ConflictException(HE.wordPairSlugExists);
    }
    const data: Prisma.WordPairUncheckedUpdateInput = {};
    if (dto.slug !== undefined) data.slug = dto.slug;
    if (dto.word !== undefined) data.word = dto.word;
    if (dto.opposite !== undefined) data.opposite = dto.opposite;
    if (dto.category !== undefined) data.category = dto.category;
    if (dto.difficulty !== undefined) data.difficulty = dto.difficulty;
    if (dto.sentence !== undefined) data.sentence = dto.sentence;
    if (dto.sentenceAnswer !== undefined) data.sentenceAnswer = dto.sentenceAnswer;
    if (dto.explanation !== undefined) data.explanation = dto.explanation;
    if (dto.imageable !== undefined) data.imageable = dto.imageable;
    if (dto.supportedTypes !== undefined) data.supportedTypes = dto.supportedTypes;
    if (dto.active !== undefined) data.active = dto.active;
    if (dto.wordImage !== undefined) data.wordImageId = await this.resolveMediaId(dto.wordImage);
    if (dto.oppositeImage !== undefined) data.oppositeImageId = await this.resolveMediaId(dto.oppositeImage);

    const row = await this.prisma.wordPair.update({ where: { id: current.id }, data, include: WORD_PAIR_INCLUDE });
    return toWordPairRecord(row);
  }

  async softDelete(id: string): Promise<{ ok: true }> {
    const current = await this.findActiveRow(id);
    await this.prisma.wordPair.update({ where: { id: current.id }, data: { deletedAt: new Date(), active: false } });
    return { ok: true };
  }

  async categories(): Promise<CategorySummary[]> {
    const grouped = await this.prisma.wordPair.groupBy({
      by: ['category'],
      where: { deletedAt: null, active: true },
      _count: { _all: true },
    });
    const counts = new Map<string, number>(grouped.map((g) => [g.category, g._count._all]));
    return Object.values(Category).map((id) => ({ id, label: CATEGORY_LABELS[id], count: counts.get(id) ?? 0 }));
  }

  async media(): Promise<MediaAssetView[]> {
    const rows = await this.prisma.mediaAsset.findMany({
      where: { deletedAt: null },
      select: { key: true, kind: true, url: true, alt: true },
      orderBy: [{ kind: 'asc' }, { key: 'asc' }],
    });
    return rows.map((r) => ({ key: r.key, kind: r.kind, url: r.url, alt: r.alt }));
  }

  /**
   * Active, non-deleted WordPair rows for building a game, with `wordImage` / `oppositeImage`
   * MediaAsset relations loaded (soft-deleted assets are returned as null).
   * `id` is the DB uuid (use it for Question.wordPairId); `slug` is the content id.
   * Filter semantics mirror `@oc/content` getActivePairs: empty categories = all, 'MIXED' = all
   * difficulties, `types` = pair must support at least one (TREASURE_CHALLENGE is ignored).
   */
  async getPlayablePairs(filter: PlayablePairFilter = {}): Promise<PlayableWordPair[]> {
    const where: Prisma.WordPairWhereInput = { deletedAt: null, active: true };
    if (filter.categories && filter.categories.length > 0) where.category = { in: filter.categories };
    if (filter.difficulty && filter.difficulty !== 'MIXED') where.difficulty = filter.difficulty as Difficulty;
    const types = (filter.types ?? []).filter((t) => t !== QuestionType.TREASURE_CHALLENGE);
    if (types.length > 0) where.supportedTypes = { hasSome: types as QuestionType[] };
    if (filter.requireImages) {
      where.imageable = true;
      where.wordImage = { is: { deletedAt: null } };
      where.oppositeImage = { is: { deletedAt: null } };
    }
    const rows = await this.prisma.wordPair.findMany({
      where,
      include: WORD_PAIR_INCLUDE,
      orderBy: [{ category: 'asc' }, { slug: 'asc' }],
    });
    return rows.map((row) => ({
      ...row,
      wordImage: row.wordImage && !row.wordImage.deletedAt ? row.wordImage : null,
      oppositeImage: row.oppositeImage && !row.oppositeImage.deletedAt ? row.oppositeImage : null,
    }));
  }

  private async findActiveRow(id: string): Promise<WordPairRow> {
    const row = UUID_RE.test(id)
      ? await this.prisma.wordPair.findFirst({ where: { id, deletedAt: null }, include: WORD_PAIR_INCLUDE })
      : await this.prisma.wordPair.findFirst({ where: { slug: id, deletedAt: null }, include: WORD_PAIR_INCLUDE });
    if (!row) throw new NotFoundException(HE.wordPairNotFound);
    return row;
  }

  /** Resolves a MediaAsset reference (key or url) to its id; `null` unlinks; `undefined` = untouched. */
  private async resolveMediaId(ref: string | null | undefined): Promise<string | null | undefined> {
    if (ref === undefined) return undefined;
    if (ref === null || ref === '') return null;
    const asset = await this.prisma.mediaAsset.findFirst({
      where: { deletedAt: null, OR: [{ key: ref }, { url: ref }] },
      select: { id: true },
    });
    if (!asset) throw new BadRequestException(HE.mediaNotFound);
    return asset.id;
  }
}

function generateSlug(): string {
  return `custom-${randomBytes(4).toString('hex')}`;
}
