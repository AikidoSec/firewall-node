.PHONY: containers
containers:
	cd apps && docker-compose up -d --remove-orphans

.PHONY: express-mongodb
express-mongodb:
	cd apps/express-mongodb && node app.js

.PHONY: express-mongoose
express-mongoose:
	cd apps/express-mongoose && node app.js

.PHONY: lambda-mongodb-nosql-injection
lambda-mongodb-nosql-injection:
	cd apps/lambda-mongodb && serverless invoke local --function login --path payloads/nosql-injection-request.json

.PHONY: lambda-mongodb-safe
lambda-mongodb-safe:
	cd apps/lambda-mongodb && serverless invoke local --function login --path payloads/safe-request.json

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

.PHONY: lint
lint:
	cd library && npm run lint
