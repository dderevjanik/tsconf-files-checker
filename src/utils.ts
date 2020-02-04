import ts from "typescript";

export const colors = {
    red: (str: string | number) => `\u001b[31m${str}\u001b[39m`,
    yellow: (str: string | number) => `\u001b[93m${str}\u001b[39m`
};

export const reporters = {
    throwError: (code: number, msg: string) => {
        throw `${colors.red(code)}\n${colors.red(msg)}`;
    },

    reportFileCheck: (fileRelPath: string, errors: ts.Diagnostic[]) => {
        console.log(`File ${colors.red(fileRelPath)} was broken with ${errors.length} error(s)`);
        console.log(errors.map(err => `\tTS${err.code}: ${colors.red(err.messageText.toString())}`).join('\n'));
    }
}

type Brand<T, U> = T & { __brand: U };
export type AbsPath = Brand<string, "AbsolutePath">;
export type RelPath = Brand<string, "RelativePath">;
