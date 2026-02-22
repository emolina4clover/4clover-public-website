# =========================================
# Stage 1: Build
# =========================================
FROM node:22-alpine AS builder

WORKDIR /app

# Instalar dependencias primero (cache layer)
COPY package*.json ./
RUN npm ci --frozen-lockfile

# Copiar el resto del codigo y compilar
COPY . .
RUN npm run build

# =========================================
# Stage 2: Serve con Nginx
# =========================================
FROM nginx:1.27-alpine AS production

# Copiar configuracion de Nginx
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copiar archivos estaticos compilados
COPY --from=builder /app/dist /usr/share/nginx/html

# Permisos correctos
RUN chmod -R 755 /usr/share/nginx/html

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost/robots.txt || exit 1

CMD ["nginx", "-g", "daemon off;"]
