import { Wrapper } from "../agent/Wrapper";
import { Client } from "pg";
import { Hook } from "require-in-the-middle";
import { massWrap } from "shimmer";
import { Agent } from "../agent/Agent";
import { getInstance } from "../agent/AgentSingleton";
import { Context, getContext } from "../agent/Context";

export class Postgres implements Wrapper {
    private checkForSqlInjection(sqlStatement:string, request:Context) {
        throw Error('We tried to filter the input! Congrats!')
    };
    private wrapQueryFunction(exports:unknown) {
        const that = this;

        massWrap(
        // @ts-expect-error This is magic that TypeScript doesn't understand
        [exports.Client.prototype, exports.Pool.prototype],
        ["query"],
        function wrapQueryFunction(original) {
            return function safeQueryFunction(this: Client ) {
                const agent = getInstance();
                if (!agent) {
                    return original.apply(this, arguments);
                }

                const request = getContext();
                if (!request) {
                    agent.onInspectedCall({
                        module: "postgres",
                        withoutContext: true,
                        detectedAttack: false,
                    });

                    return original.apply(this, arguments);
                }

                if (!Array.isArray(arguments[0])) {
                    return original.apply(this, arguments);
                }

                that.checkForSqlInjection("TEST", request);




                return original.apply(this, arguments);
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