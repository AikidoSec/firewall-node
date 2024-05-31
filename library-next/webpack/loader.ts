import { LoaderOptions } from "../types";

// https://webpack.js.org/api/loaders
export default function loader(
  this: {
    resourcePath: string;
    getOptions: () => LoaderOptions;
    async: () => (
      err: Error | null,
      content: string | Buffer,
      map: object | null,
      meta: any
    ) => void;
  },
  content: string,
  map: object,
  meta: any
) {
  const callback = this.async();
  const options: LoaderOptions = this.getOptions();

  // Skip processing for Next.js internal files
  if (content.includes("__next_internal_client_entry_do_not_use__")) {
    callback(null, content, map, meta);
    return;
  }

  if (options.type === "route-handler") {
    // Todo inject route handler logic (using babel?)
  }

  callback(null, content, map, meta);
  return;
}

// Ensure that content is always a string and not a Buffer
export const raw = false;
