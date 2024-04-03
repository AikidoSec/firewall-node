const fs = require("fs/promises");
const path = require("path");

class Documents {
  constructor(folderName) {
    this.directory = folderName;
  }

  async add(filename, content) {
    await fs.writeFile(this.directory + filename, content, "utf8");
  }

  async getAll() {
    return await fs.readdir(this.directory);
  }
}

module.exports = Documents;
