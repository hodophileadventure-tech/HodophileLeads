# Stage 1: Build Backend
FROM node:20-alpine AS backend-build
WORKDIR /build/backend
COPY backend/package*.json ./
RUN npm install
COPY backend/tsconfig.json ./
COPY backend/src ./src
COPY backend/scripts ./scripts
COPY backend/jest.config.js ./
RUN npm run build

# Stage 2: Build Frontend
FROM node:20-alpine AS frontend-build
WORKDIR /build/frontend
COPY frontend/package*.json ./
RUN npm install
COPY frontend/tsconfig.json ./
COPY frontend/tsconfig.node.json ./
COPY frontend/vite.config.ts ./
COPY frontend/index.html ./
COPY frontend/postcss.config.js ./
COPY frontend/tailwind.config.js ./
COPY frontend/src ./src
COPY frontend/public ./public
ENV VITE_API_BASE_URL=/api
RUN npm run build

# Stage 3: Runtime - Nginx + Backend
FROM node:20-alpine
RUN apk add --no-cache nginx

# Setup backend
WORKDIR /app/backend
COPY backend/package*.json ./
RUN npm install --omit=dev
COPY --from=backend-build /build/backend/dist ./dist
COPY backend/scripts ./scripts

ENV NODE_ENV=production
ENV PORT=5000

# Copy frontend build to nginx
COPY --from=frontend-build /build/frontend/dist /usr/share/nginx/html

# Copy nginx config
COPY frontend/nginx.conf /etc/nginx/conf.d/default.conf

# Copy startup script
COPY start.sh /app/start.sh
RUN chmod +x /app/start.sh

WORKDIR /app
EXPOSE 80

CMD ["/app/start.sh"]
