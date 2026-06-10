# syntax=docker/dockerfile:1

# ---- Dependencies stage -------------------------------------------------
# Install only production dependencies in an isolated layer so they can be
# copied into the runtime image without dev tooling (eslint, jest, ...).
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# ---- Runtime stage ------------------------------------------------------
FROM node:22-alpine AS runtime

# The app mirrors sites by spawning GNU wget (--mirror, --convert-links, ...).
# Alpine's `wget` package provides GNU wget, replacing the limited BusyBox one.
RUN apk add --no-cache wget

ENV NODE_ENV=production \
    PORT=3000

WORKDIR /app

# App source first, then the clean production node_modules so it always wins
# (even if a stray node_modules slips past .dockerignore).
COPY . .
COPY --from=deps /app/node_modules ./node_modules

# Runtime working dirs the app writes into, owned by the unprivileged user
# that already ships with the node image.
RUN mkdir -p downloads public/sites \
    && chown -R node:node /app

USER node

EXPOSE 3000

# Hit the served index page; uses the wget installed above.
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD wget -q --spider http://127.0.0.1:3000/ || exit 1

CMD ["node", "bin/www"]
