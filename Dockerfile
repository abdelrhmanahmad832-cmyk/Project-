FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY server/package.json server/
COPY client/package.json client/
RUN npm ci
COPY . .
RUN npm run build && npm prune --omit=dev

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production \
    PORT=4000 \
    DB_PATH=/app/data/store.db \
    UPLOAD_DIR=/app/data/uploads
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/server ./server
COPY --from=build /app/client/dist ./client/dist
VOLUME /app/data
EXPOSE 4000
CMD ["node", "--disable-warning=ExperimentalWarning", "server/src/index.js"]
