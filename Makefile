.PHONY: containers
containers:
	cd sample-apps && docker-compose up -d --remove-orphans

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

.PHONY: lambda-mongodb-nosql-injection
lambda-mongodb-nosql-injection:
	cd sample-apps/lambda-mongodb && npx serverless@3.38.0 invoke local -e AIKIDO_BLOCKING=true -e AIKIDO_DEBUG=true --function login --path payloads/nosql-injection-request.json

.PHONY: lambda-mongodb-safe
lambda-mongodb-safe:
	cd sample-apps/lambda-mongodb && npx serverless@3.38.0 invoke local -e AIKIDO_BLOCKING=true -e AIKIDO_DEBUG=true --function login --path payloads/safe-request.json

.PHONY: install
install:
	mkdir -p build && cp library/package.json build/package.json
	touch build/index.js
	npm install --workspaces || true
	npm install --workspaces

.PHONY: build
build:
	mkdir -p build
	rm -r build
	cd library && npm run build
	cp README.md build/README.md
	cp LICENSE build/LICENSE
	cp library/package.json build/package.json

.PHONY: watch
watch: build
	cd library && npm run build:watch

.PHONY: test
test:
	cd library && npm run test

.PHONY: test-ci
test-ci:
	cd library && npm run test:ci

.PHONY: lint
lint:
	cd library && npm run lint

.PHONY: end2end
end2end:
	cd end2end && npm run test

benchmark: build
	cd benchmarks/nosql-injection && node benchmark.js
	cd benchmarks/shell-injection && node benchmark.js
	cd benchmarks/sql-injection && node benchmark.js
