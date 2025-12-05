FROM node:24-slim

WORKDIR /app

COPY package.json package-lock.json /app/

RUN npm ci

COPY . /app/

CMD ["node" , "/app/app.ts"]
