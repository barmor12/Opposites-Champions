# syntax=docker/dockerfile:1.7
# =====================================================================
# אלופי ההפכים – אימג' השרת (NestJS + Prisma)
# Opposites Champions – server image (NestJS + Prisma)
#
# Build context = שורש הריפו (monorepo):
#   docker build -f apps/server/Dockerfile -t oc-server .
#
# שלבים / Stages:
#   1. builder  – התקנת תלויות ה-workspace, prisma generate, nest build,
#                 ואז `pnpm deploy --prod` לתיקייה נקייה עם תלויות production בלבד.
#   2. runtime  – אימג' רזה: dist + node_modules של production, כלי prisma/tsx
#                 (ל-migrate deploy ול-seed), משתמש שאינו root, HEALTHCHECK.
#
# פלט הבנייה (dist/) הוא self-contained: dist/apps/server/src/main.js + dist/packages/*,
# כך שבזמן ריצה נדרשים רק node_modules של production של @oc/server.
# ה-seed (prisma/seed.ts) רץ עם tsx ומייבא את @oc/shared / @oc/content כ-TypeScript;
# `pnpm deploy` מעתיק את חבילות ה-workspace הללו (כולל src/) לתוך node_modules/@oc/*,
# לכן ה-seed עובד באימג' ה-runtime בלי קוד מקור נוסף.
# =====================================================================

ARG NODE_IMAGE=node:22-alpine
ARG PNPM_VERSION=10.28.0

# ---------------------------------------------------------------------
# Stage 1: builder
# ---------------------------------------------------------------------
FROM ${NODE_IMAGE} AS builder
ARG PNPM_VERSION

# כלי בנייה ל-native modules (argon2 בונה מהמקור אם אין prebuilt ל-musl), openssl ל-Prisma engines
RUN apk add --no-cache python3 make g++ openssl libc6-compat

# pnpm דרך corepack, מוצמד לגרסה שב-package.json ("packageManager")
ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0 \
    PNPM_HOME=/pnpm \
    PATH=/pnpm:$PATH
RUN corepack enable && corepack prepare "pnpm@${PNPM_VERSION}" --activate \
    && pnpm config set store-dir /pnpm/store

WORKDIR /repo

# --- שכבה 1: מניפסטים בלבד (cache-friendly) -----------------------------
# שינוי בקוד לא מבטל את שכבת ההתקנה; רק שינוי ב-lockfile / package.json.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY apps/server/package.json       apps/server/
COPY apps/web/package.json          apps/web/
COPY packages/shared/package.json   packages/shared/
COPY packages/content/package.json  packages/content/
COPY tests/e2e/package.json         tests/e2e/

# התקנה רק של @oc/server והתלויות שלו ב-workspace (@oc/shared, @oc/content).
# ה-store נשמר ב-BuildKit cache mount – בניות חוזרות לא מורידות מחדש.
# onlyBuiltDependencies (pnpm-workspace.yaml) מאשר את סקריפטי ה-postinstall של prisma/argon2.
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    pnpm install --frozen-lockfile --filter "@oc/server..."

# --- שכבה 2: קוד מקור ----------------------------------------------------
COPY tsconfig.base.json ./
COPY packages/shared    packages/shared
COPY packages/content   packages/content
COPY apps/server        apps/server

# Prisma client + בניית השרת
RUN pnpm --filter @oc/server exec prisma generate \
    && pnpm --filter @oc/server build \
    && test -f apps/server/dist/apps/server/src/main.js \
    || { echo "ERROR: expected apps/server/dist/apps/server/src/main.js after nest build"; exit 1; }

# --- שכבה 3: תיקיית deploy עם תלויות production בלבד --------------------
# pnpm 10 דורש --legacy ל-deploy ללא inject-workspace-packages.
# התוצאה: /out/apps/server עם package.json, dist/, prisma/ ו-node_modules (prod) –
# כולל עותקים אמיתיים של @oc/shared ו-@oc/content (עם src/ ל-tsx seed).
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    pnpm --filter @oc/server deploy --legacy --prod /out/apps/server \
    && rm -rf /out/apps/server/src /out/apps/server/test

# כלי CLI לזמן ריצה: prisma (migrate deploy) ו-tsx (seed) – devDependencies של השרת,
# לכן מותקנים בנפרד ב-/opt/tools, בגרסאות הזהות ל-lockfile.
RUN PRISMA_VERSION="$(node -p "require('/repo/apps/server/node_modules/prisma/package.json').version")" \
    && TSX_VERSION="$(node -p "require('/repo/apps/server/node_modules/tsx/package.json').version")" \
    && echo "tools: prisma@${PRISMA_VERSION} tsx@${TSX_VERSION}" \
    && mkdir -p /opt/tools && cd /opt/tools \
    && npm init -y >/dev/null \
    && npm install --no-audit --no-fund --omit=dev "prisma@${PRISMA_VERSION}" "tsx@${TSX_VERSION}" \
    && npm cache clean --force

# יצירת Prisma client בתוך תיקיית ה-deploy (ההתקנה שם טרייה ואינה כוללת את ה-client שנוצר ב-/repo)
RUN cd /out/apps/server && /opt/tools/node_modules/.bin/prisma generate

# ---------------------------------------------------------------------
# Stage 2: runtime
# ---------------------------------------------------------------------
FROM ${NODE_IMAGE} AS runtime

# openssl נדרש ל-Prisma engines ב-Alpine; wget (busybox) משמש ל-HEALTHCHECK
RUN apk add --no-cache openssl libc6-compat \
    && mkdir -p /app/apps/server && chown -R node:node /app

ENV NODE_ENV=production \
    PORT=3000 \
    PATH=/opt/tools/node_modules/.bin:$PATH

WORKDIR /app/apps/server

# תלויות production + package.json + prisma/ (מ-pnpm deploy)
COPY --from=builder --chown=node:node /out/apps/server ./
# dist במפורש (גם אם .npmignore/.gitignore עתידי יחריג אותו מה-deploy)
COPY --from=builder --chown=node:node /repo/apps/server/dist ./dist
# prisma + tsx
COPY --from=builder --chown=node:node /opt/tools /opt/tools

# entrypoint: migrate deploy → seed (אופציונלי) → node. sed מסיר CRLF אם ה-checkout היה ב-Windows.
COPY --chmod=755 apps/server/docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN sed -i 's/\r$//' /usr/local/bin/docker-entrypoint.sh

USER node
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD wget -qO- "http://127.0.0.1:${PORT}/api/health" >/dev/null || exit 1

ENTRYPOINT ["docker-entrypoint.sh"]
CMD ["node", "dist/apps/server/src/main.js"]
