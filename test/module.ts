// this file should NOT be included because it has strict error
import { x } from "./dontInclude";

const z: string = x;

export function plus(a: number, b: number, c?: number) {
    return a + b + c;
}
