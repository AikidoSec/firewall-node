const { createWriteStream, createReadStream } = require("fs");
const { pipeline } = require("stream/promises");
const { extract } = require("tar");
const { readFile } = require("fs/promises");
const { createHash } = require("crypto");
const https = require("follow-redirects").https;

function downloadFile(url, path, retries = 3) {
  return new Promise((resolve, reject) => {
    const attempt = (remaining) => {
      const stream = createWriteStream(path);
      let settled = false;
      const cleanup = () => {
        stream.removeAllListeners("finish");
        stream.removeAllListeners("error");
      };
      const onError = (err) => {
        if (!settled) {
          settled = true;
          cleanup();
          if (remaining > 0) {
            stream.close(() => {
              console.error(
                `Download failed, retrying... (${remaining} attempts left)`
              );
              setTimeout(() => {
                attempt(remaining - 1);
              }, 1000); // Wait 1 second before retrying
            });
          } else {
            reject(err);
          }
        }
      };
      const onFinish = () => {
        if (!settled) {
          settled = true;
          cleanup();
          stream.close(resolve);
        }
      };

      // Send http request to download the file
      https
        .get(url, (response) => {
          response.pipe(stream);
        })
        .on("error", onError);
      stream.on("finish", onFinish);
      stream.on("error", onError);
    };

    // Start the first attempt
    attempt(retries);
  });
}

async function extractTar(path, dest) {
  await extract({ file: path, sync: false, cwd: dest });
}

async function verifyFileHash(filepath) {
  const expectedHash = (await readFile(`${filepath}.sha256sum`, "utf8")).split(
    " "
  )[0];
  const input = createReadStream(filepath);
  const hashBuilder = createHash("sha256");
  await pipeline(input, hashBuilder);

  const hash = hashBuilder.digest("hex");

  if (hash !== expectedHash) {
    console.log(`Expected: ${expectedHash}`);
    console.log(`Actual: ${hash}`);
    throw new Error(`File hash mismatch for ${filepath}`);
  }
}

module.exports = {
  downloadFile,
  extractTar,
  verifyFileHash,
};
