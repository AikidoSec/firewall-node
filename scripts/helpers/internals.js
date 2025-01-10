const { createWriteStream, createReadStream } = require("fs");
const { Readable } = require("stream");
const { finished, pipeline } = require("stream/promises");
const { extract } = require("tar");
const { readFile } = require("fs/promises");
const { createHash } = require("crypto");

async function downloadFile(url, path) {
  const stream = createWriteStream(path);
  const { ok, body } = await fetch(url);
  if (!ok) {
    throw new Error(`Failed to download file from ${url}`);
  }
  await finished(Readable.fromWeb(body).pipe(stream));
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
