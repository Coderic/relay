# Dockerfile base para aplicaciones que consumen Kafka y Redis
# Usar como base para tus microservicios

FROM python:3.12-slim

LABEL maintainer="neftaliyagua"
LABEL description="Base image para servicios con Kafka y Redis"

# Variables de entorno
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

# Directorio de trabajo
WORKDIR /app

# Instalar dependencias del sistema
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copiar requirements
COPY requirements.txt .

# Instalar dependencias de Python
RUN pip install --no-cache-dir -r requirements.txt

# Copiar código fuente
COPY . .

# Puerto por defecto (ajustar según la aplicación)
EXPOSE 8000

# Comando por defecto
CMD ["python", "main.py"]

