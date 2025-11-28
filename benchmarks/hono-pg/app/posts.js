class Post {
  constructor(title, createdAt, text) {
    this._title = title;
    this._text = text;
  }

  getTitle() {
    return this._title;
  }

  getText() {
    return this._text;
  }
}

class Posts {
  constructor(db) {
    this.db = db;
  }

  async add(title, text, authors) {
    const articleRes = await this.db.query(
      "INSERT INTO posts (title, text) VALUES ($1, $2) RETURNING id",
      [title, text]
    );

    const articleId = articleRes.rows[0].id;

    for (const author of authors) {
      const authorExists = await this.db.query(
        "SELECT id FROM authors WHERE name = $1",
        [author]
      );
      let authorId;
      if (authorExists.rows.length === 0) {
        const authorRes = await this.db.query(
          "INSERT INTO authors (name) VALUES ($1) RETURNING id",
          [author]
        );
        authorId = authorRes.rows[0].id;
      } else {
        authorId = authorExists.rows[0].id;
      }

      await this.db.query(
        "INSERT INTO post_authors (post_id, author_id) VALUES ($1, $2)",
        [articleId, authorId]
      );
    }
  }

  async find(title) {
    const post = await this.db.query(
      "SELECT title, text FROM posts WHERE title = $1",
      [title]
    );

    return post.rows.length > 0 ? post.rows[0] : null;
  }

  async count() {
    const result = await this.db.query("SELECT COUNT(*) as count FROM posts;");

    return result.rows[0].count;
  }
}

module.exports = {
  Posts,
  Post,
};
