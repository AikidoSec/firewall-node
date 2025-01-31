import sqlite3 from "sqlite3";

const instance = new sqlite3.Database("./cats.db");

let initialized = false;

async function db() {
  if (!initialized) {
    await new Promise((resolve, reject) => {
      instance.run("CREATE TABLE IF NOT EXISTS cats (name TEXT)", (err) => {
        if (err) {
          reject(err);
        } else {
          resolve(instance);
        }
      });

      initialized = true;
    });
  }

  return instance;
}

export { db };
