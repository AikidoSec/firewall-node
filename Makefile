express-mongodb-install:
	cd apps/express-mongodb && npm install && docker-compose up -d --remove-orphans

express-mongodb:
	cd apps/express-mongodb && node app.js
