class User {
  constructor(username, password) {
    this._username = username;
    this._password = password;
  }

  getUsername() {
    return this._username;
  }

  getPassword() {
    return this._password;
  }
}

class Users {
  constructor(mongo) {
    this.db = mongo.db("app");
  }

  // This is just for demo purposes, normally you'd use bcrypt or something
  async findBy(username, password) {
    const collection = this.db.collection("users");
    const user = await collection.findOne({
      username: username,
      password: password,
    });

    if (!user) {
      return undefined;
    }

    return new User(user.username, user.password);
  }

  async persist(user) {
    const collection = this.db.collection("users");
    await collection.insertOne({
      username: user.getUsername(),
      password: user.getPassword(),
    });
  }
}

module.exports = {
  Users,
  User,
};
