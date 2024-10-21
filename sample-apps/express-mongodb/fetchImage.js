const https = require("https");
const http = require("http");

async function fetchImage(url) {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith("https") ? https : http;

    protocol
      .get(url, (response) => {
        let data = [];

        response.on("data", (chunk) => {
          data.push(chunk);
        });

        response.on("end", () => {
          const buffer = Buffer.concat(data);
          resolve({
            statusCode: response.statusCode,
            body: buffer,
          });
        });

        response.on("error", (err) => {
          reject(err);
        });
      })
      .on("error", (err) => {
        reject(err);
      });
  });
}

module.exports = fetchImage;
