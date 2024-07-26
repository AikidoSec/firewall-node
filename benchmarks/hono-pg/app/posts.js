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

  async add(title, text) {
    // This is unsafe! This is for demo purposes only, you should use parameterized queries.
    await this.db.query(
      `INSERT INTO posts (title, text) VALUES ('${title}', '${text}');`
    );
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
