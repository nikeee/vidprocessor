FROM oven/bun:latest as prod-dependencies
    WORKDIR /app
    # ENV RUN NODE_ENV=production

    COPY package.json bun.lockb ./

    RUN bun install

FROM oven/bun:latest
    WORKDIR /app
    ENV NODE_ENV=production

    RUN apt-get update -yqqq && \
        apt-get install -yqqq \
            ffmpeg \
            curl \
        && apt-get clean \
        && rm -rf /var/lib/apt/lists/*

    # RUN apt-get update -yqqq && apt install --no-cache ffmpeg curl

    COPY --from=prod-dependencies /app/node_modules /app/node_modules
    COPY ./ /app

    EXPOSE 8080
    CMD ["bun", "src/index.ts"]

    HEALTHCHECK --interval=30s --timeout=30s --start-period=5s --retries=3 \
        CMD curl --fail -I http://localhost:8080/_health || exit 1
