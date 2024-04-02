const fs = require("fs");
const path = require("path");

class Documents {
  constructor(folderName) {
    this.directory = folderName;
  }

  async add(filename, content) {
    return new Promise((resolve, reject) => {
      try {
        // This code is vulnerable to path traversal
        // An attacker can pass a filename like ../../../../etc/passwd
        // And write to any file on the system
        // Do not use this code in production
        fs.writeFileSync(this.directory + filename, content, "utf8");
        resolve(true);
      } catch (err) {
        reject(err);
      }
    });
  }

  async getAll() {
    return new Promise((resolve, reject) => {
      try {
        resolve(fs.readdirSync(this.directory));
      } catch (err) {
        reject(err);
      }
    });
  }
}

module.exports = Documents;
