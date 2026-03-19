FROM node:24-alpine AS build

WORKDIR /app

COPY apps/web/package*.json ./
RUN npm ci

COPY apps/web/ .
RUN npx ng build --configuration production

# --- Serve ---
FROM nginx:alpine

COPY docker/nginx/default.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist/web/browser /usr/share/nginx/html

EXPOSE 80
