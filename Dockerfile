# Pasarela v2.0 - Node.js con Socket.io, Redis y Kafka
FROM node:22-alpine

LABEL maintainer="NeftaliYagua"
LABEL version="2.0.0"
LABEL description="Pasarela de comunicación con Socket.io, Redis y Kafka"

# Directorio de trabajo
WORKDIR /app

# Copiar archivos de dependencias
COPY package*.json ./

# Instalar dependencias
RUN npm install --omit=dev

# Copiar código fuente
COPY src/ ./src/
COPY public/ ./public/

# Usuario no-root
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001 && \
    chown -R nodejs:nodejs /app

USER nodejs

# Puerto
EXPOSE 5000

# Variables de entorno por defecto
ENV NODE_ENV=production
ENV PORT=5000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:5000/health || exit 1

# Iniciar
CMD ["node", "src/server.js"]

