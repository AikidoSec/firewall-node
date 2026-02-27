import { BootMixin } from "@loopback/boot";
import { ApplicationConfig } from "@loopback/core";
import {
  RestExplorerBindings,
  RestExplorerComponent,
} from "@loopback/rest-explorer";
import { RepositoryMixin } from "@loopback/repository";
import { JsonBodyParser, RestApplication } from "@loopback/rest";
import { ServiceMixin } from "@loopback/service-proxy";
import path from "path";
import { MySequence } from "./sequence";
import { UsersRepository } from "./repositories/users.repository";
import { zenMiddleware } from "./middleware/zen.middleware";

export { ApplicationConfig };

export class Loopback4PsqlApplication extends BootMixin(
  ServiceMixin(RepositoryMixin(RestApplication))
) {
  constructor(options: ApplicationConfig = {}) {
    super(options);

    // Set up the custom sequence
    this.sequence(MySequence);

    this.bodyParser(JsonBodyParser);
    this.middleware(zenMiddleware);

    // Set up default home page
    this.static("/", path.join(__dirname, "../public"));

    // Customize @loopback/rest-explorer configuration here
    this.configure(RestExplorerBindings.COMPONENT).to({
      path: "/explorer",
    });
    this.component(RestExplorerComponent);

    this.projectRoot = __dirname;
    // Customize @loopback/boot Booter Conventions here
    this.bootOptions = {
      controllers: {
        // Customize ControllerBooter Conventions here
        dirs: ["controllers"],
        extensions: [".controller.js"],
        nested: true,
      },
    };

    // Register UsersRepository to ensure users table is created
    this.repository(UsersRepository);
  }
}
