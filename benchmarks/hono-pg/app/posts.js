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
    // This is unsafe! This is for demo purposes only, you should use parameterized queries.
    const articleRes = await this.db.query(
      `INSERT INTO posts (title, text) VALUES ('${title}', '${text}') RETURNING id;`
    );

    const articleId = articleRes.rows[0].id;

    for (const author of authors) {
      const authorExists = await this.db.query(
        `SELECT id FROM authors WHERE name = '${author}';`
      );
      let authorId;
      if (authorExists.rows.length === 0) {
        const authorRes = await this.db.query(
          `INSERT INTO authors (name) VALUES ('${author}') RETURNING id;`
        );
        authorId = authorRes.rows[0].id;
      } else {
        authorId = authorExists.rows[0].id;
      }

      await this.db.query(
        `INSERT INTO post_authors (post_id, author_id) VALUES (${articleId}, ${authorId});`
      );
    }
  }

  async find(title) {
    const post = await this.db.query(
      `SELECT title, text FROM posts WHERE title = '${title}';`
    );

    return post.rows.length > 0 ? post.rows[0] : null;
  }

  async getAll() {
    const posts = await this.db.query("SELECT title, text FROM posts;");

    return posts.rows;
  }
}

module.exports = {
  Posts,
  Post,
};
