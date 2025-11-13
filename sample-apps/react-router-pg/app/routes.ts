import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
  index("routes/home.tsx"),
  route("add-cat", "routes/add-cat.ts"),
  route("clear-cats", "routes/clear-cats.ts"),
] satisfies RouteConfig;
