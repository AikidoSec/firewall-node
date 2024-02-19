import { Wrapper } from "../agent/Wrapper";
import { Client } from "pg";
import { Hook } from "require-in-the-middle";
import { wrap } from "shimmer";
import { Agent } from "../agent/Agent";
import { getInstance } from "../agent/AgentSingleton";

export class Postgres implements Wrapper {
    private wrapQueryFunction(exports:unknown) {
        const that = this;

        wrap(
        // @ts-expect-error This is magic that TypeScript doesn't understand
        exports.Client.prototype,
        "query",
        function wrapQueryFunction(original) {
            return function safeQueryFunction(this: Client ) {
                const agent = getInstance();

                if (!agent) {
                    return original.apply(this, arguments);
                }
            }
        }
        )
    }

    private onModuleRequired<T>(exports: T): T {
        this.wrapQueryFunction(exports);
        return exports;
    }
    
    wrap() {
        new Hook(["pg"], this.onModuleRequired.bind(this));
    }
}