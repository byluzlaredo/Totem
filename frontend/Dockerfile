FROM node:22-bookworm-slim AS build

WORKDIR /app

ENV NPM_CONFIG_UPDATE_NOTIFIER=false

ARG VITE_APP_NAME=TOTEM
ARG VITE_API_URL=
ARG VITE_AUTH_ME_TIMEOUT_MS=12000

ENV VITE_APP_NAME=$VITE_APP_NAME
ENV VITE_API_URL=$VITE_API_URL
ENV VITE_AUTH_ME_TIMEOUT_MS=$VITE_AUTH_ME_TIMEOUT_MS

COPY package*.json ./
RUN npm ci && npm cache clean --force

COPY . .
RUN npm run build

FROM nginx:1.27-alpine

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -q --spider http://127.0.0.1/health || exit 1
