const mongoose = require("mongoose");

const CatScheme = new mongoose.Schema({
  name: String,
  createdAt: Date,
});

const Cat = mongoose.model("Cat", CatScheme);

module.exports = { Cat };
