FROM node:24-slim

USER node
WORKDIR /app

COPY --chown=node:node package.json package-lock.json ./
RUN npm ci --ignore-scripts

COPY --chown=node:node . ./
RUN node --run check:types

CMD ["node" , "app.ts"]
