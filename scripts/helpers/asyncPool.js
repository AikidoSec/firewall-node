// Source: https://github.com/rxaviers/async-pool/blob/1.x/lib/es7.js
// Copyright 2017 Rafael Xavier de Souza http://rafael.xavier.blog.br
// MIT License

async function asyncPool(poolLimit, iterable, iteratorFn) {
  const ret = [];
  const executing = new Set();
  for (const item of iterable) {
    const p = Promise.resolve().then(() => iteratorFn(item, iterable));
    ret.push(p);
    executing.add(p);
    const clean = () => executing.delete(p);
    p.then(clean).catch(clean);
    if (executing.size >= poolLimit) {
      await Promise.race(executing);
    }
  }
  return Promise.all(ret);
}

module.exports = asyncPool;
