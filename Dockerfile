FROM node:22-bullseye as builder

WORKDIR /app

COPY package*.json ./
COPY yarn.lock ./

RUN yarn install

COPY . .

RUN yarn build

FROM nginx:alpine

COPY --from=builder /app/dist /usr/share/nginx/html

COPY .docker/nginx/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

RUN apk add --no-cache bash

# Ensure the script is copied and has correct permissions
COPY .docker/docker-runtime.env.sh /usr/share/nginx/html/docker-runtime.env.sh
RUN chmod +x /usr/share/nginx/html/docker-runtime.env.sh

CMD ["/bin/sh", "-c", "/usr/share/nginx/html/docker-runtime.env.sh && rm -rf /usr/share/nginx/html/docker-runtime.env.sh && nginx -g 'daemon off;'"]
