FROM node:24-alpine AS dependencies
WORKDIR /app
COPY package*.json ./
RUN npm ci --no-audit --no-fund

FROM dependencies AS development
COPY --chown=node:node src/ ./src/
USER node
EXPOSE 3001
CMD ["npm", "start"]

FROM node:24-alpine AS production
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev --no-audit --no-fund && npm cache clean --force
COPY --chown=node:node src/ ./src/
USER node
EXPOSE 3001
CMD ["npm", "start"]
