import { MongoDB } from "./modules/mongodb";

export function bootstrap() {
  const modules = [new MongoDB()];

  modules.forEach((module) => {
    module.setup();
  });
}
