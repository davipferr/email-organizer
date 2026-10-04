# Builds the React app and serves it with Caddy, which also proxies /api to the
# backend and gets HTTPS certificates automatically.
FROM node:24-slim AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM caddy:2-alpine
COPY --from=build /app/dist /srv
