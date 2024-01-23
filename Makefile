.PHONY: containers
containers:
	cd apps/express-mongodb && docker-compose up -d --remove-orphans

.PHONY: express-mongodb
express-mongodb:
	cd apps/express-mongodb && node app.js

.PHONY: build
build:
	cd library && mkdir -p ./dist && rm -r ./dist && npm run build

.PHONY: watch
watch:
	cd library && mkdir -p ./dist && rm -r ./dist && npm run build:watch