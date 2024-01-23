const { trace, context } = require("@opentelemetry/api");

class Post {
  constructor(title, createdAt) {
    this._title = title;
    this._createdAt = createdAt;
  }

  getTitle() {
    return this._title;
  }

  getCreatedAt() {
    return this._createdAt;
  }
}

class Posts {
  constructor(mongo) {
    this.db = mongo.db("app");
  }

  async all() {
    const collection = this.db.collection("posts");
    const posts = await collection.find({}).toArray();

    return posts.map((post) => new Post(post.title, post.createdAt));
  }

  async persist(post) {
    const collection = this.db.collection("posts");
    await collection.insertOne({
      title: post.getTitle(),
      createdAt: post.getCreatedAt(),
    });
  }
}

module.exports = {
  Posts,
  Post,
};
