containers:
	docker-compose up -d --remove-orphans

express-mongodb:
	cd lib/apps/express-mongodb && node app.js
