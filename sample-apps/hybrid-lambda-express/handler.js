const protect = require("@aikidosec/firewall/lambda");
const serverless = require('serverless-http');
const createApp = require('./app');

const app = createApp({ serverless: true });

module.exports.handler = protect(serverless(app));