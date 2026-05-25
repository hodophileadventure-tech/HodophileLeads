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
FROM nginx:1.27-alpine

# Install Node.js on top of nginx image
RUN apk add --no-cache nodejs npm

# Remove default nginx config
RUN rm /etc/nginx/conf.d/default.conf

# Copy nginx config
COPY nginx-prod.conf /etc/nginx/conf.d/default.conf

# Verify config is valid
RUN nginx -t

# Copy frontend build
COPY --from=frontend-build /build/frontend/dist /usr/share/nginx/html

# Setup backend
RUN mkdir -p /app/backend
WORKDIR /app/backend
COPY backend/package*.json ./
RUN npm install --omit=dev
COPY --from=backend-build /build/backend/dist ./dist
COPY backend/scripts ./scripts

ENV NODE_ENV=production
ENV PORT=5000

# Copy startup script
COPY start.sh /app/start.sh
RUN chmod +x /app/start.sh

WORKDIR /app
EXPOSE 80

CMD ["/app/start.sh"]
