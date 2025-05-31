FROM --platform=linux/amd64 node:20-bullseye as builder

WORKDIR /app

COPY package.json yarn.lock ./

RUN yarn install --frozen-lockfile

COPY . .

COPY .docker/.docker.env .env

RUN yarn build

FROM --platform=linux/amd64 nginx:alpine-slim

COPY --from=builder /app/dist /usr/share/nginx/html

COPY .docker/nginx/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

RUN apk add --no-cache bash

COPY .docker/docker-runtime.env.sh /usr/share/nginx/html/docker-runtime.env.sh
RUN chmod +x /usr/share/nginx/html/docker-runtime.env.sh

ENTRYPOINT ["/bin/sh", "-c", "/usr/share/nginx/html/docker-runtime.env.sh && rm -rf /usr/share/nginx/html/docker-runtime.env.sh && nginx -g 'daemon off;'"]
