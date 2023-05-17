FROM node:alpine as builder
    WORKDIR /usr/app
    COPY package.json package-lock.json ./
    RUN npm ci
    COPY . .
    RUN npm run build

FROM node:alpine as prod-dependencies
    WORKDIR /usr/app
    COPY package.json package-lock.json ./
    RUN npm ci --omit=dev

FROM node:alpine
    WORKDIR /app
    ENV NODE_ENV=production

    RUN apk add --no-cache ffmpeg curl

    COPY package.json package-lock.json ./
    COPY --from=builder /usr/app/node_modules /app/node_modules

    COPY --from=builder /usr/app/dist /app/dist

    EXPOSE 8080
    CMD ["node", "dist/index.js"]

    HEALTHCHECK --interval=30s --timeout=30s --start-period=5s --retries=3 \
        CMD curl --fail -I http://localhost:8080/_health || exit 1
