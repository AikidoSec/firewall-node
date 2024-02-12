export interface Logger {
  log(message: string): void;
}

export class LoggerConsole {
  log(message: string) {
    console.log(`AIKIDO: ${message}`);
  }
}

export class LoggerNoop {
  log(message: string) {
    // noop
  }
}
