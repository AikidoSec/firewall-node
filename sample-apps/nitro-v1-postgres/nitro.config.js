export default {
  compatibilityDate: "2026-10-30",
  // Zen can only protect packages that are loaded from node_modules at runtime right now
  externals: {
    external: ["h3", "pg"],
  },
};
