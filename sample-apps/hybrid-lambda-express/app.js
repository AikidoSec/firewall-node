const express = require('express');
const Zen = require("@aikidosec/firewall");

function createApp(config = {}) {
    const app = express();
    
    if (!config.serverless) {
        Zen.addExpressMiddleware(app);
    }
    
    app.get('/hello', function (req, res) {
        res.json({ message: 'Hello World!' });
    });

    return app;
}

module.exports = createApp;