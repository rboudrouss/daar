# ===================================
# Stage 1: Build Frontend
# ===================================
FROM node:20-alpine AS frontend-builder

WORKDIR /app

# Copier les fichiers de configuration du workspace
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY tsconfig.base.json tsconfig.json ./

# Copier la lib (dépendance workspace)
COPY lib ./lib

# Copier le frontend
COPY Frontend ./Frontend

# Installer pnpm
RUN npm install -g pnpm

# Installer les dépendances et builder le frontend
RUN pnpm install --frozen-lockfile
RUN cd Frontend && pnpm run build

# ===================================
# Stage 2: Build Backend
# ===================================
FROM node:20-alpine AS backend-builder

WORKDIR /app

# Copier les fichiers de configuration du workspace
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY tsconfig.base.json tsconfig.json ./

# Copier la lib (dépendance workspace)
COPY lib ./lib

# Copier le backend
COPY Backend ./Backend

# Installer pnpm
RUN npm install -g pnpm

# Installer les dépendances (incluant better-sqlite3 qui nécessite une compilation native)
RUN pnpm install --frozen-lockfile

# Builder le backend
RUN cd Backend && pnpm run build

# ===================================
# Stage 3: Production
# ===================================
FROM node:20-alpine AS production

WORKDIR /app

# Installer pnpm
RUN npm install -g pnpm

# Copier les fichiers de configuration du workspace
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY tsconfig.base.json tsconfig.json ./

# Copier la lib
COPY lib ./lib

# Copier le backend
COPY Backend/package.json ./Backend/package.json

# Installer uniquement les dépendances de production
RUN pnpm install --frozen-lockfile --prod

# Copier le backend buildé depuis le stage builder
COPY --from=backend-builder /app/Backend/dist ./Backend/dist

# Copier le frontend buildé depuis le stage builder
COPY --from=frontend-builder /app/Frontend/dist ./frontend/dist

# Créer le répertoire data pour la base de données
RUN mkdir -p /app/Backend/data

# Exposer le port
EXPOSE 3000

# Variables d'environnement par défaut
ENV NODE_ENV=production
ENV PORT=3000
ENV DB_PATH=/app/Backend/data/library.db
ENV FRONTEND_PATH=/app/frontend/dist

# Démarrer l'application
WORKDIR /app/Backend
CMD ["node", "dist/index.js"]

