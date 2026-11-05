// Idempotent seed: achievements, media assets, word pairs, initial teacher.
// Run with `pnpm prisma:seed` (tsx resolves the @oc/* workspace packages directly from TS source).
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { PrismaClient, type MediaKind, type Prisma } from '@prisma/client';
import * as argon2 from 'argon2';
import { ACHIEVEMENT_LABELS, AchievementType, type WordPairContent } from '@oc/shared';
import { ASSET_MANIFEST, WORD_PAIRS } from '@oc/content';

interface AssetManifestEntry {
  key: string;
  kind: 'WORD_IMAGE' | 'AVATAR' | 'CHARACTER';
  url: string;
  alt: string;
}

function loadDotEnv(): void {
  const envPath = resolve(__dirname, '..', '.env');
  if (!existsSync(envPath)) return;
  try {
    // Node >= 20.12: populates process.env without overriding existing values.
    process.loadEnvFile(envPath);
  } catch {
    // ignore – env may already be provided by the shell / prisma CLI
  }
}

const prisma = new PrismaClient();

async function seedAchievements(): Promise<number> {
  let n = 0;
  for (const type of Object.values(AchievementType)) {
    const label = ACHIEVEMENT_LABELS[type];
    await prisma.achievement.upsert({
      where: { type },
      create: { type, title: label.title, description: label.description, emoji: label.emoji },
      update: { title: label.title, description: label.description, emoji: label.emoji },
    });
    n += 1;
  }
  return n;
}

async function seedMedia(manifest: AssetManifestEntry[]): Promise<Map<string, string>> {
  const ids = new Map<string, string>();
  for (const asset of manifest) {
    const kind: MediaKind = asset.kind;
    const row = await prisma.mediaAsset.upsert({
      where: { key: asset.key },
      create: { key: asset.key, kind, url: asset.url, alt: asset.alt },
      update: { kind, url: asset.url, alt: asset.alt, deletedAt: null },
      select: { id: true, key: true },
    });
    ids.set(row.key, row.id);
  }
  return ids;
}

function wordPairData(pair: WordPairContent, media: Map<string, string>): Omit<Prisma.WordPairUncheckedCreateInput, 'slug'> {
  const wordImageId = media.get(`pair:${pair.id}:word`) ?? null;
  const oppositeImageId = media.get(`pair:${pair.id}:opposite`) ?? null;
  return {
    word: pair.word,
    opposite: pair.opposite,
    category: pair.category,
    difficulty: pair.difficulty,
    sentence: pair.sentence,
    sentenceAnswer: pair.sentenceAnswer,
    explanation: pair.explanation ?? null,
    imageable: pair.imageable,
    wordImageId,
    oppositeImageId,
    supportedTypes: pair.supportedTypes,
    active: pair.active,
  };
}

async function seedWordPairs(pairs: WordPairContent[], media: Map<string, string>): Promise<number> {
  let n = 0;
  for (const pair of pairs) {
    const data = wordPairData(pair, media);
    await prisma.wordPair.upsert({
      where: { slug: pair.id },
      create: { slug: pair.id, ...data },
      update: { ...data, deletedAt: null },
    });
    n += 1;
  }
  return n;
}

async function seedTeacher(): Promise<'created' | 'exists' | 'skipped'> {
  const email = process.env.TEACHER_INITIAL_EMAIL?.trim().toLowerCase();
  const password = process.env.TEACHER_INITIAL_PASSWORD;
  const name = process.env.TEACHER_INITIAL_NAME?.trim() || 'המורה';
  if (!email || !password) return 'skipped';
  const existing = await prisma.teacher.findUnique({ where: { email }, select: { id: true } });
  if (existing) return 'exists';
  const passwordHash = await argon2.hash(password, { type: argon2.argon2id });
  await prisma.teacher.create({ data: { email, passwordHash, name } });
  return 'created';
}

async function main(): Promise<void> {
  loadDotEnv();
  const achievements = await seedAchievements();
  const media = await seedMedia(ASSET_MANIFEST as AssetManifestEntry[]);
  const pairs = await seedWordPairs(WORD_PAIRS, media);
  const teacher = await seedTeacher();
  console.log(`[seed] achievements=${achievements} media=${media.size} wordPairs=${pairs} teacher=${teacher}`);
}

main()
  .catch((err: unknown) => {
    console.error('[seed] failed', err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
