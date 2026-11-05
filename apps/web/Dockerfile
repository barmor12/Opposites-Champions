# syntax=docker/dockerfile:1.7
# =====================================================================
# אלופי ההפכים – אימג' הלקוח (Vite React SPA מוגש ע"י nginx)
# Opposites Champions – web image (Vite React SPA served by nginx)
#
# Build context = שורש הריפו:
#   docker build -f apps/web/Dockerfile --build-arg VITE_API_URL=/api -t oc-web .
#
# VITE_API_URL נאפה לתוך ה-bundle בזמן הבנייה (ברירת מחדל: /api – נתיב יחסי,
# כך שה-proxy (nginx) מנתב /api ו-/socket.io לשרת ואין צורך ב-CORS).
# =====================================================================

ARG NODE_IMAGE=node:22-alpine
ARG NGINX_IMAGE=nginx:1.27-alpine
ARG PNPM_VERSION=10.28.0

# ---------------------------------------------------------------------
# Stage 1: builder
# ---------------------------------------------------------------------
FROM ${NODE_IMAGE} AS builder
ARG PNPM_VERSION

ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0 \
    PNPM_HOME=/pnpm \
    PATH=/pnpm:$PATH
RUN corepack enable && corepack prepare "pnpm@${PNPM_VERSION}" --activate \
    && pnpm config set store-dir /pnpm/store

WORKDIR /repo

# מניפסטים בלבד – שכבת התקנה שנשמרת ב-cache כל עוד ה-lockfile לא השתנה
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY apps/server/package.json       apps/server/
COPY apps/web/package.json          apps/web/
COPY packages/shared/package.json   packages/shared/
COPY packages/content/package.json  packages/content/
COPY tests/e2e/package.json         tests/e2e/

RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    pnpm install --frozen-lockfile --filter "@oc/web..."

# קוד מקור
COPY tsconfig.base.json ./
COPY packages/shared    packages/shared
COPY apps/web           apps/web

# משתני VITE_* חייבים להיות זמינים בזמן build (נאפים לתוך ה-bundle)
# VITE_API_URL   – בסיס ה-API (ברירת מחדל: /api, יחסי לאותו origin)
# VITE_SOCKET_URL – כתובת Socket.IO; ריק = אותו origin (ברירת המחדל הרצויה מאחורי nginx)
ARG VITE_API_URL=/api
ARG VITE_SOCKET_URL=
ENV VITE_API_URL=${VITE_API_URL} \
    VITE_SOCKET_URL=${VITE_SOCKET_URL}

RUN pnpm --filter @oc/web build \
    && test -f apps/web/dist/index.html

# ---------------------------------------------------------------------
# Stage 2: nginx
# ---------------------------------------------------------------------
FROM ${NGINX_IMAGE} AS runtime

# קונפיגורציית SPA: fallback ל-index.html, gzip, cache לנכסים, no-cache ל-index.html,
# כותרות אבטחה, ו-proxy נוח ל-/api ו-/socket.io (לסטאק המקומי ללא nginx חיצוני)
COPY infrastructure/nginx/web.conf      /etc/nginx/conf.d/default.conf
COPY infrastructure/nginx/snippets      /etc/nginx/snippets

COPY --from=builder /repo/apps/web/dist /usr/share/nginx/html

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://127.0.0.1/healthz >/dev/null || exit 1

CMD ["nginx", "-g", "daemon off;"]
