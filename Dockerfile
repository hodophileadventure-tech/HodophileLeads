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
RUN ls -la /build/frontend/dist/

# Stage 3: Combine both (Node serves frontend, proxies backend via separate port)
FROM node:20-alpine
RUN apk add --no-cache nginx

WORKDIR /app

# Copy backend
COPY backend/package*.json ./backend/
RUN cd backend && npm install --omit=dev
COPY --from=backend-build /build/backend/dist ./backend/dist
COPY backend/scripts ./backend/scripts

# Copy frontend
COPY --from=frontend-build /build/frontend/dist ./backend/public

# Setup nginx to serve frontend and proxy API
RUN mkdir -p /etc/nginx/conf.d && rm -f /etc/nginx/conf.d/default.conf

RUN cat > /etc/nginx/conf.d/default.conf << 'EOF'
server {
  listen 80;
  server_name _;

  root /app/backend/public;
  index index.html;

  location / {
    try_files $uri $uri/ /index.html;
  }

  location /api/ {
    proxy_pass http://127.0.0.1:5000;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }

  location /health {
    proxy_pass http://127.0.0.1:5000;
  }

  location /uploads/ {
    proxy_pass http://127.0.0.1:5000;
  }
}
EOF

ENV NODE_ENV=production
ENV PORT=5000

# Copy startup script
COPY start.sh /app/start.sh
RUN chmod +x /app/start.sh

EXPOSE 80

CMD ["/app/start.sh"]
