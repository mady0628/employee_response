FROM node:22-bookworm-slim

WORKDIR /app
ARG WITH_CHROMIUM=false
RUN if [ "$WITH_CHROMIUM" = "true" ]; then apt-get update && apt-get install -y --no-install-recommends chromium && rm -rf /var/lib/apt/lists/*; fi
ENV PUPPETEER_SKIP_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium
COPY package.json package-lock.json ./
COPY apps ./apps
COPY database ./database
COPY shared ./shared
RUN npm ci --omit=dev && mkdir -p /app/.wwebjs_auth /app/logs && chown -R node:node /app

ENV NODE_ENV=production
ENV HOST=0.0.0.0
ARG WORKSPACE
ENV WORKSPACE=${WORKSPACE}
USER node
CMD ["sh", "-c", "npm run start --workspace=\"$WORKSPACE\""]
