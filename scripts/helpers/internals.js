const { createWriteStream, createReadStream } = require("fs");
const { pipeline } = require("stream/promises");
const { extract } = require("tar");
const { readFile } = require("fs/promises");
const { createHash } = require("crypto");
const https = require("follow-redirects").https;

function downloadFile(url, path) {
  return new Promise((resolve, reject) => {
    const stream = createWriteStream(path);
    https
      .get(url, (response) => {
        response.pipe(stream);
      })
      .on("error", reject);

    stream.on("finish", () => {
      stream.close(resolve);
    });
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
