const { protect } = require('@aikidosec/guard');
protect({ debug: true });
const mongoose = require('mongoose');

const connectMongo = async () =>
  mongoose
    .connect('mongodb://root:password@127.0.0.1:27017')
    .catch((e) => console.error("Mongoose Client Error: " + e.message));

module.exports = connectMongo;
