-- CreateEnum
CREATE TYPE "GameState" AS ENUM ('CREATED', 'WAITING_FOR_PLAYERS', 'COUNTDOWN', 'QUESTION_ACTIVE', 'QUESTION_RESULTS', 'NEXT_QUESTION', 'FINAL_RESULTS', 'COMPLETED', 'PAUSED', 'CANCELLED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "GameMode" AS ENUM ('SELF_PACED', 'TEACHER_PACED');

-- CreateEnum
CREATE TYPE "QuestionType" AS ENUM ('CHOOSE_OPPOSITE', 'CHOOSE_IMAGE', 'MATCH_PAIRS', 'COMPLETE_SENTENCE', 'TREASURE_CHALLENGE');

-- CreateEnum
CREATE TYPE "Difficulty" AS ENUM ('EASY', 'MEDIUM', 'HARD');

-- CreateEnum
CREATE TYPE "Category" AS ENUM ('SIZES', 'COLORS_LIGHT', 'EMOTIONS', 'ACTIONS', 'TIME_SPEED', 'DIRECTIONS_PLACES', 'ANIMALS_NATURE', 'TRAITS_STATES', 'OBJECTS_ENVIRONMENT', 'CHALLENGING');

-- CreateEnum
CREATE TYPE "AchievementType" AS ENUM ('OPPOSITES_CHAMPION', 'PERSISTENCE_CHAMPION', 'TEN_CORRECT', 'FIVE_STREAK', 'ACCURACY_CHAMPION', 'PERSONAL_BEST');

-- CreateEnum
CREATE TYPE "MediaKind" AS ENUM ('WORD_IMAGE', 'AVATAR', 'CHARACTER', 'AUDIO');

-- CreateTable
CREATE TABLE "Teacher" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Teacher_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Classroom" (
    "id" UUID NOT NULL,
    "teacherId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Classroom_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Student" (
    "id" UUID NOT NULL,
    "displayName" TEXT NOT NULL,
    "nameKey" TEXT NOT NULL,
    "avatar" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Student_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GameRoom" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "teacherId" UUID NOT NULL,
    "classroomId" UUID,
    "className" TEXT NOT NULL,
    "state" "GameState" NOT NULL DEFAULT 'CREATED',
    "joinOpen" BOOLEAN NOT NULL DEFAULT true,
    "settings" JSONB NOT NULL,
    "mode" "GameMode" NOT NULL DEFAULT 'SELF_PACED',
    "currentSessionId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "expiresAt" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "GameRoom_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GameSession" (
    "id" UUID NOT NULL,
    "roomId" UUID NOT NULL,
    "roundNumber" INTEGER NOT NULL DEFAULT 1,
    "state" "GameState" NOT NULL DEFAULT 'WAITING_FOR_PLAYERS',
    "mode" "GameMode" NOT NULL DEFAULT 'SELF_PACED',
    "settings" JSONB NOT NULL,
    "currentQuestionIndex" INTEGER,
    "questionStartedAt" TIMESTAMP(3),
    "questionEndsAt" TIMESTAMP(3),
    "pausedAt" TIMESTAMP(3),
    "pausedRemainingMs" INTEGER,
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GameSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GameParticipant" (
    "id" UUID NOT NULL,
    "roomId" UUID NOT NULL,
    "studentId" UUID NOT NULL,
    "sessionTokenHash" TEXT NOT NULL,
    "connected" BOOLEAN NOT NULL DEFAULT false,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "removedAt" TIMESTAMP(3),
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GameParticipant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ParticipantProgress" (
    "id" UUID NOT NULL,
    "sessionId" UUID NOT NULL,
    "participantId" UUID NOT NULL,
    "currentIndex" INTEGER NOT NULL DEFAULT 0,
    "questionStartedAt" TIMESTAMP(3),
    "score" INTEGER NOT NULL DEFAULT 0,
    "correctAnswers" INTEGER NOT NULL DEFAULT 0,
    "answeredCount" INTEGER NOT NULL DEFAULT 0,
    "totalResponseMs" INTEGER NOT NULL DEFAULT 0,
    "streak" INTEGER NOT NULL DEFAULT 0,
    "bestStreak" INTEGER NOT NULL DEFAULT 0,
    "treasureCorrect" INTEGER NOT NULL DEFAULT 0,
    "finished" BOOLEAN NOT NULL DEFAULT false,
    "finishedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ParticipantProgress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WordPair" (
    "id" UUID NOT NULL,
    "slug" TEXT NOT NULL,
    "word" TEXT NOT NULL,
    "opposite" TEXT NOT NULL,
    "category" "Category" NOT NULL,
    "difficulty" "Difficulty" NOT NULL,
    "sentence" TEXT NOT NULL,
    "sentenceAnswer" TEXT NOT NULL DEFAULT 'opposite',
    "explanation" TEXT,
    "imageable" BOOLEAN NOT NULL DEFAULT false,
    "wordImageId" UUID,
    "oppositeImageId" UUID,
    "supportedTypes" "QuestionType"[],
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "WordPair_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Question" (
    "id" UUID NOT NULL,
    "type" "QuestionType" NOT NULL,
    "wordPairId" UUID,
    "prompt" TEXT NOT NULL,
    "promptImage" TEXT,
    "explanation" TEXT,
    "payload" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Question_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuestionOption" (
    "id" UUID NOT NULL,
    "questionId" UUID NOT NULL,
    "text" TEXT NOT NULL,
    "image" TEXT,
    "isCorrect" BOOLEAN NOT NULL DEFAULT false,
    "order" INTEGER NOT NULL,

    CONSTRAINT "QuestionOption_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SessionQuestion" (
    "id" UUID NOT NULL,
    "sessionId" UUID NOT NULL,
    "questionId" UUID NOT NULL,
    "index" INTEGER NOT NULL,
    "isTreasure" BOOLEAN NOT NULL DEFAULT false,
    "treasureStep" INTEGER,
    "timeLimitMs" INTEGER NOT NULL DEFAULT 0,
    "startedAt" TIMESTAMP(3),
    "endsAt" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),

    CONSTRAINT "SessionQuestion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudentAnswer" (
    "id" UUID NOT NULL,
    "sessionId" UUID NOT NULL,
    "sessionQuestionId" UUID NOT NULL,
    "participantId" UUID NOT NULL,
    "selectedOptionId" UUID,
    "answerPayload" JSONB,
    "isCorrect" BOOLEAN NOT NULL,
    "elapsedMs" INTEGER NOT NULL,
    "scoreAwarded" INTEGER NOT NULL,
    "answeredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StudentAnswer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScoreEvent" (
    "id" UUID NOT NULL,
    "sessionId" UUID NOT NULL,
    "participantId" UUID NOT NULL,
    "reason" TEXT NOT NULL,
    "points" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ScoreEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Achievement" (
    "id" UUID NOT NULL,
    "type" "AchievementType" NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "emoji" TEXT NOT NULL,

    CONSTRAINT "Achievement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudentAchievement" (
    "id" UUID NOT NULL,
    "sessionId" UUID NOT NULL,
    "participantId" UUID NOT NULL,
    "achievementId" UUID NOT NULL,
    "awardedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StudentAchievement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MediaAsset" (
    "id" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "kind" "MediaKind" NOT NULL,
    "url" TEXT NOT NULL,
    "alt" TEXT NOT NULL,
    "width" INTEGER,
    "height" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "MediaAsset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" UUID NOT NULL,
    "teacherId" UUID,
    "roomId" UUID,
    "action" TEXT NOT NULL,
    "details" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Teacher_email_key" ON "Teacher"("email");

-- CreateIndex
CREATE INDEX "Classroom_teacherId_idx" ON "Classroom"("teacherId");

-- CreateIndex
CREATE UNIQUE INDEX "GameRoom_code_key" ON "GameRoom"("code");

-- CreateIndex
CREATE INDEX "GameRoom_teacherId_createdAt_idx" ON "GameRoom"("teacherId", "createdAt");

-- CreateIndex
CREATE INDEX "GameRoom_state_idx" ON "GameRoom"("state");

-- CreateIndex
CREATE INDEX "GameSession_roomId_state_idx" ON "GameSession"("roomId", "state");

-- CreateIndex
CREATE UNIQUE INDEX "GameSession_roomId_roundNumber_key" ON "GameSession"("roomId", "roundNumber");

-- CreateIndex
CREATE UNIQUE INDEX "GameParticipant_sessionTokenHash_key" ON "GameParticipant"("sessionTokenHash");

-- CreateIndex
CREATE INDEX "GameParticipant_roomId_removedAt_idx" ON "GameParticipant"("roomId", "removedAt");

-- CreateIndex
CREATE UNIQUE INDEX "GameParticipant_roomId_studentId_key" ON "GameParticipant"("roomId", "studentId");

-- CreateIndex
CREATE INDEX "ParticipantProgress_sessionId_score_correctAnswers_totalRes_idx" ON "ParticipantProgress"("sessionId", "score" DESC, "correctAnswers" DESC, "totalResponseMs");

-- CreateIndex
CREATE UNIQUE INDEX "ParticipantProgress_sessionId_participantId_key" ON "ParticipantProgress"("sessionId", "participantId");

-- CreateIndex
CREATE UNIQUE INDEX "WordPair_slug_key" ON "WordPair"("slug");

-- CreateIndex
CREATE INDEX "WordPair_category_difficulty_active_idx" ON "WordPair"("category", "difficulty", "active");

-- CreateIndex
CREATE INDEX "Question_type_idx" ON "Question"("type");

-- CreateIndex
CREATE INDEX "QuestionOption_questionId_idx" ON "QuestionOption"("questionId");

-- CreateIndex
CREATE INDEX "SessionQuestion_sessionId_idx" ON "SessionQuestion"("sessionId");

-- CreateIndex
CREATE UNIQUE INDEX "SessionQuestion_sessionId_index_key" ON "SessionQuestion"("sessionId", "index");

-- CreateIndex
CREATE INDEX "StudentAnswer_sessionId_participantId_idx" ON "StudentAnswer"("sessionId", "participantId");

-- CreateIndex
CREATE UNIQUE INDEX "StudentAnswer_sessionQuestionId_participantId_key" ON "StudentAnswer"("sessionQuestionId", "participantId");

-- CreateIndex
CREATE INDEX "ScoreEvent_sessionId_participantId_idx" ON "ScoreEvent"("sessionId", "participantId");

-- CreateIndex
CREATE UNIQUE INDEX "Achievement_type_key" ON "Achievement"("type");

-- CreateIndex
CREATE UNIQUE INDEX "StudentAchievement_sessionId_participantId_achievementId_key" ON "StudentAchievement"("sessionId", "participantId", "achievementId");

-- CreateIndex
CREATE UNIQUE INDEX "MediaAsset_key_key" ON "MediaAsset"("key");

-- CreateIndex
CREATE INDEX "AuditLog_roomId_createdAt_idx" ON "AuditLog"("roomId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_teacherId_createdAt_idx" ON "AuditLog"("teacherId", "createdAt");

-- AddForeignKey
ALTER TABLE "Classroom" ADD CONSTRAINT "Classroom_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "Teacher"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GameRoom" ADD CONSTRAINT "GameRoom_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "Teacher"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GameRoom" ADD CONSTRAINT "GameRoom_classroomId_fkey" FOREIGN KEY ("classroomId") REFERENCES "Classroom"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GameSession" ADD CONSTRAINT "GameSession_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "GameRoom"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GameParticipant" ADD CONSTRAINT "GameParticipant_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "GameRoom"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GameParticipant" ADD CONSTRAINT "GameParticipant_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ParticipantProgress" ADD CONSTRAINT "ParticipantProgress_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "GameSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ParticipantProgress" ADD CONSTRAINT "ParticipantProgress_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "GameParticipant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WordPair" ADD CONSTRAINT "WordPair_wordImageId_fkey" FOREIGN KEY ("wordImageId") REFERENCES "MediaAsset"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WordPair" ADD CONSTRAINT "WordPair_oppositeImageId_fkey" FOREIGN KEY ("oppositeImageId") REFERENCES "MediaAsset"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Question" ADD CONSTRAINT "Question_wordPairId_fkey" FOREIGN KEY ("wordPairId") REFERENCES "WordPair"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuestionOption" ADD CONSTRAINT "QuestionOption_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "Question"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionQuestion" ADD CONSTRAINT "SessionQuestion_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "GameSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionQuestion" ADD CONSTRAINT "SessionQuestion_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "Question"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentAnswer" ADD CONSTRAINT "StudentAnswer_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "GameSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentAnswer" ADD CONSTRAINT "StudentAnswer_sessionQuestionId_fkey" FOREIGN KEY ("sessionQuestionId") REFERENCES "SessionQuestion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentAnswer" ADD CONSTRAINT "StudentAnswer_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "GameParticipant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScoreEvent" ADD CONSTRAINT "ScoreEvent_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "GameSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScoreEvent" ADD CONSTRAINT "ScoreEvent_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "GameParticipant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentAchievement" ADD CONSTRAINT "StudentAchievement_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "GameSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentAchievement" ADD CONSTRAINT "StudentAchievement_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "GameParticipant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentAchievement" ADD CONSTRAINT "StudentAchievement_achievementId_fkey" FOREIGN KEY ("achievementId") REFERENCES "Achievement"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "Teacher"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "GameRoom"("id") ON DELETE SET NULL ON UPDATE CASCADE;
