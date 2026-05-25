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

# Create nginx config
RUN mkdir -p /etc/nginx/conf.d

# Nginx config for reverse proxy
RUN cat > /etc/nginx/conf.d/default.conf << 'EOF'
server {
    listen 80;
    server_name _;

    gzip on;
    gzip_types text/plain text/css text/javascript application/json application/javascript;

    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;

    location / {
        root /usr/share/nginx/html;
        index index.html;
        try_files $uri $uri/ /index.html;
    }

    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        root /usr/share/nginx/html;
        expires 1y;
        add_header Cache-Control "public, immutable";
        access_log off;
    }

    location ~* \.html?$ {
        root /usr/share/nginx/html;
        expires -1;
        add_header Cache-Control "public, must-revalidate, proxy-revalidate";
    }

    location /api/ {
        proxy_pass http://localhost:5000/api/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    location /health {
        proxy_pass http://localhost:5000;
    }

    location /uploads/ {
        proxy_pass http://localhost:5000/uploads/;
    }
}
EOF

# Copy frontend build
COPY --from=frontend-build /build/frontend/dist /usr/share/nginx/html

# Setup backend
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
