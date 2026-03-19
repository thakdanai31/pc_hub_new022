FROM node:24-alpine AS build

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY prisma.config.ts ./
COPY prisma ./prisma

# Prisma config eagerly resolves DATABASE_URL even during generate (no connection made).
# Provide a placeholder so the build succeeds without a real database.
ARG DATABASE_URL=mysql://build:build@localhost:3306/build
ENV DATABASE_URL=${DATABASE_URL}
RUN npx prisma generate

COPY tsconfig.json ./
COPY src ./src
RUN npm run build

# --- Production ---
FROM node:24-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY --from=build /app/src/generated ./src/generated
COPY --from=build /app/dist ./dist

EXPOSE 3000

CMD ["node", "dist/server.js"]
