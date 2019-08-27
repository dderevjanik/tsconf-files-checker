import ts from "typescript";

export function red(str: string) {
    return `\u001b[31m${str}\u001b[39m`;
}

export function yellow(str: string) {
    return `\u001b[93m${str}\u001b[39m`;
}

export function throwError(type: string, msg: string) {
    throw new Error(`${red(type)}\n${red(msg)}`);
}

export function reportFileCheck(fileRelPath: string, errors: ts.Diagnostic[]) {
    console.log(`File ${red(fileRelPath)} was broken with ${errors.length} error(s)`);
    console.log(errors.map(err => `\tTS${err.code}: ${red(err.messageText.toString())}`).join('\n'));
}
