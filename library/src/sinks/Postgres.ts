import { Wrapper } from "../agent/Wrapper";
import { Hook } from "require-in-the-middle";
import { wrap } from "shimmer";
import { Agent } from "../agent/Agent";
import { getInstance } from "../agent/AgentSingleton";

export class Postgres implements Wrapper {
    private wrapQueryFunction(exports:unknown) {
        
    }

    private onModuleRequired<T>(exports: T): T {
        this.wrapQueryFunction(exports);
        return exports;
    }
    
    wrap() {
        new Hook(["pg"], this.onModuleRequired.bind(this));
    }
}