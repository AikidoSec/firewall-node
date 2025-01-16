module.exports = {
  step: async function step() {
    await fetch("http://localhost:10411");
  },
};
