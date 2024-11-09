FROM node:22.11.0-alpine3.20 AS builder

WORKDIR /app

COPY package.json yarn.lock ./

RUN yarn install

COPY . .

RUN yarn run frontend:build

# Serve app by Nginx
FROM nginx:1.23.2-alpine

COPY --from=builder /app/dist /var/www/metasam-is

COPY ./deploy/nginx.conf /etc/nginx/nginx.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]