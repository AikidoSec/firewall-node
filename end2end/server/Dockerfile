FROM node:22

WORKDIR /app

COPY package.json /app

RUN npm install

COPY . /app

CMD ["node" , "/app/app.js"]
