FROM node:20-bookworm-slim

ENV NODE_ENV=production \
    PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    RENDER_LOCAL_STORAGE=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

RUN apt-get update && apt-get install -y --no-install-recommends \
    chromium ca-certificates fonts-liberation fonts-noto-color-emoji \
    libasound2 libatk-bridge2.0-0 libatk1.0-0 libc6 libcairo2 libcups2 \
    libdbus-1-3 libdrm2 libgbm1 libglib2.0-0 libgtk-3-0 libnspr4 libnss3 \
    libpango-1.0-0 libu2f-udev libvulkan1 libx11-6 libx11-xcb1 libxcb1 \
    libxcomposite1 libxdamage1 libxext6 libxfixes3 libxrandr2 xdg-utils \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY package*.json ./
COPY apps/ ./apps/
COPY packages/ ./packages/
COPY services/ ./services/
COPY api/ ./api/
COPY cloudrun-server.ts ./cloudrun-server.ts
COPY tsconfig.json ./tsconfig.json

RUN npm install --omit=dev && npm install --no-save tsx@4.19.2

EXPOSE 10000
CMD ["npx", "tsx", "cloudrun-server.ts"]
