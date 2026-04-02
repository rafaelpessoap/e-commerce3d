# ---- Dependencies ----
FROM node:22-alpine AS deps
WORKDIR /app
COPY backend/package.json backend/package-lock.json ./
RUN npm ci --ignore-scripts

# ---- Build ----
FROM node:22-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY backend/ ./
# Generate Prisma client
RUN npx prisma generate
# Build NestJS
RUN npm run build

# ---- Production ----
FROM node:22-alpine AS production
WORKDIR /app

ENV NODE_ENV=production

# Copy only production deps
COPY backend/package.json backend/package-lock.json ./
RUN npm ci --ignore-scripts --omit=dev

# Copy Prisma schema + config (needed for migrations)
COPY backend/prisma ./prisma
COPY backend/prisma.config.ts ./prisma.config.ts

# Copy built app
COPY --from=build /app/dist ./dist
# Copy generated Prisma client
COPY --from=build /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=build /app/node_modules/@prisma ./node_modules/@prisma

# Non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nestjs -u 1001 -G nodejs
USER nestjs

EXPOSE 4000

HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD wget -qO- http://localhost:4000/api/health || exit 1

CMD ["node", "dist/main.js"]
