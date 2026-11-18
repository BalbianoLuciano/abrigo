# Imagen única para la API y el worker (Cloud Run: dos servicios, distinto comando).
FROM node:24-slim AS build
WORKDIR /app
RUN corepack enable
COPY . .
RUN pnpm install --frozen-lockfile \
  && pnpm turbo run build --filter=@abrigo/api... \
  && pnpm deploy --filter=@abrigo/api --prod --legacy /out

FROM node:24-slim
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build /out .
USER node
EXPOSE 8080
ENV PORT=8080
# API por defecto; el worker usa: node dist/worker.js
CMD ["node", "dist/main.js"]
