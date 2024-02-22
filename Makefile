.PHONY: containers
containers:
	cd sample-apps && docker-compose up -d --remove-orphans

.PHONY: express-mongodb
express-mongodb:
	cd sample-apps/express-mongodb && node app.js

.PHONY: express-mongoose
express-mongoose:
	cd sample-apps/express-mongoose && node app.js

.PHONY: express-postgres
express-postgres:
	cd sample-apps/express-postgres && node app.js

.PHONY: express-mysql2
express-mysql2:
	cd sample-apps/express-mysql2 && node app.js

.PHONY: express-mariadb
express-mariadb:
	cd sample-apps/express-mariadb && node app.js

.PHONY: express-mssql
express-mssql:
	cd sample-apps/express-mssql && node app.js

.PHONY: lambda-mongodb-nosql-injection
lambda-mongodb-nosql-injection:
	cd sample-apps/lambda-mongodb && npx serverless invoke local --function login --path payloads/nosql-injection-request.json

.PHONY: lambda-mongodb-safe
lambda-mongodb-safe:
	cd sample-apps/lambda-mongodb && npx serverless invoke local --function login --path payloads/safe-request.json

.PHONY: docs
docs:
	npx typedoc

.PHONY: install
install:
	npm install --workspaces

.PHONY: build
build:
	cd library && mkdir -p ./dist && rm -r ./dist && npm run build

.PHONY: watch
watch:
	cd library && mkdir -p ./dist && rm -r ./dist && npm run build:watch

.PHONY: test
test:
	cd library && npm run test

.PHONY: test-ci
test-ci:
	cd library && npm run test:ci

.PHONY: lint
lint:
	cd library && npm run lint

test-end-to-end:
	cd end2end && npm run test
