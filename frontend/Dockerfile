FROM node:24-alpine AS dependencies
WORKDIR /app
COPY package*.json ./
RUN npm ci

FROM dependencies AS development
COPY --chown=node:node . .
RUN chown -R node:node /app
USER node
EXPOSE 5173
CMD ["npm", "run", "dev"]

FROM dependencies AS builder
COPY . .
RUN npm run build

FROM nginx:1.28-alpine AS production
COPY --from=builder /app/dist/ /usr/share/nginx/html/
COPY nginx.conf /etc/nginx/conf.d/default.conf
RUN mkdir -p /tmp/nginx /var/cache/nginx \
    && chown -R nginx:nginx /usr/share/nginx/html /tmp/nginx /var/cache/nginx \
    && sed -i '/^[[:space:]]*pid[[:space:]]/d' /etc/nginx/nginx.conf \
    && sed -i '/^[[:space:]]*user[[:space:]]/d' /etc/nginx/nginx.conf
USER nginx
EXPOSE 8080
HEALTHCHECK --interval=15s --timeout=3s --start-period=15s --retries=3 \
    CMD wget -q -O /dev/null http://127.0.0.1:8080/ || exit 1
CMD ["nginx", "-g", "pid /tmp/nginx.pid; daemon off;"]