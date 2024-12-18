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
    this.postsCollection = this.db.collection("posts");
  }

  async all(search) {
    const filter = {};
    if (search) {
      // There's a vulnerability here, which can be abused for demo purposes
      filter.title = search;
    }

    const posts = await this.postsCollection.find(filter).toArray();

    return posts.map((post) => new Post(post.title, post.createdAt));
  }

  async persist(post) {
    await this.postsCollection.insertOne({
      title: post.getTitle(),
      createdAt: post.getCreatedAt(),
    });
  }

  async where(title) {
    return await this.postsCollection
      .find({ $where: `this.title === '${title}'` })
      .toArray();
  }
}

module.exports = {
  Posts,
  Post,
};
