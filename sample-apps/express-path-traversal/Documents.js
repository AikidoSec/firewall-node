const fs = require('node:fs')
const path = require('path');

class Documents {
  constructor(folderName){
    this.directory=folderName;
  }

  async add(filename, content) {
    console.log(`add called`);
    return new Promise((resolve, reject) => {
      try {
        const absolutePath = path.resolve(this.directory, filename);
        // const absolutePath = this.directory+filename;
          fs.writeFileSync(absolutePath, content);
          resolve(true);
      } catch (err) {
          reject(err);
      }
    });
  }

  async getAll() {
    console.log(`getAll called`);

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
