import mongoose from "mongoose";

const connectMongo = async () =>
  mongoose
    .connect('mongodb://root:password@127.0.0.1:27017')
    .catch((e) => console.error("Mongoose Client Error: " + e.message));

export default connectMongo;
