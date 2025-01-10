.PHONY: express-mongodb
express-mongodb:
	cd sample-apps/express-mongodb && AIKIDO_DEBUG=true AIKIDO_BLOCKING=true node app.js

.PHONY: express-mongoose
express-mongoose:
	cd sample-apps/express-mongoose && AIKIDO_DEBUG=true AIKIDO_BLOCKING=true node app.js

.PHONY: express-postgres
express-postgres:
	cd sample-apps/express-postgres && AIKIDO_DEBUG=true AIKIDO_BLOCKING=true node app.js

.PHONY: express-mysql
express-mysql:
	cd sample-apps/express-mysql && AIKIDO_DEBUG=true AIKIDO_BLOCKING=true node app.js

.PHONY: express-mysql2
express-mysql2:
	cd sample-apps/express-mysql2 && AIKIDO_DEBUG=true AIKIDO_BLOCKING=true node app.js

.PHONY: express-mariadb
express-mariadb:
	cd sample-apps/express-mariadb && AIKIDO_DEBUG=true AIKIDO_BLOCKING=true node app.js

.PHONY: express-path-traversal
express-path-traversal:
	cd sample-apps/express-path-traversal && AIKIDO_DEBUG=true AIKIDO_BLOCKING=true node app.js

.PHONY: express-graphql
express-graphql:
	cd sample-apps/express-graphql && AIKIDO_DEBUG=true AIKIDO_BLOCKING=true node app.js

.PHONY: hono-xml
hono-xml:
	cd sample-apps/hono-xml && AIKIDO_DEBUG=true AIKIDO_BLOCKING=true node app.js

.PHONY: hono-sqlite3
hono-sqlite3:
	cd sample-apps/hono-sqlite3 && AIKIDO_DEBUG=true AIKIDO_BLOCKING=true node app.js

.PHONY: hapi-postgres
hapi-postgres:
	cd sample-apps/hapi-postgres && AIKIDO_DEBUG=true AIKIDO_BLOCKING=true node app.js

.PHONY: micro
micro:
	cd sample-apps/micro && AIKIDO_DEBUG=true AIKIDO_BLOCKING=true node --require @aikidosec/firewall ./node_modules/.bin/micro

.PHONY: lambda-mongodb-nosql-injection
lambda-mongodb-nosql-injection:
	cd sample-apps/lambda-mongodb && npx serverless@3.38.0 invoke local -e AIKIDO_BLOCKING=true -e AIKIDO_DEBUG=true --function login --path payloads/nosql-injection-request.json

.PHONY: lambda-mongodb-safe
lambda-mongodb-safe:
	cd sample-apps/lambda-mongodb && npx serverless@3.38.0 invoke local -e AIKIDO_BLOCKING=true -e AIKIDO_DEBUG=true --function login --path payloads/safe-request.json

.PHONY: nestjs-sentry
nestjs-sentry:
	cd sample-apps/nestjs-sentry && AIKIDO_DEBUG=true AIKIDO_BLOCKING=true NODE_OPTIONS=npm run start

.PHONY: nestjs-fastify
nestjs-fastify:
	cd sample-apps/nestjs-fastify && AIKIDO_DEBUG=true AIKIDO_BLOCKING=true NODE_OPTIONS=npm run start

.PHONY: fastify-mysql2
fastify-mysql2:
	cd sample-apps/fastify-mysql2 && AIKIDO_DEBUG=true AIKIDO_BLOCKING=true node app.js

.PHONY: koa-sqlite3
koa-sqlite3:
	cd sample-apps/koa-sqlite3 && AIKIDO_DEBUG=true AIKIDO_BLOCKING=true node app.js

.PHONY: fastify-clickhouse
fastify-clickhouse:
	cd sample-apps/fastify-clickhouse && AIKIDO_DEBUG=true AIKIDO_BLOCKING=true node app.js

.PHONY: hono-prisma
hono-prisma:
	cd sample-apps/hono-prisma && AIKIDO_DEBUG=true AIKIDO_BLOCK=true node app.js
