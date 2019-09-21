#!/usr/bin/env node

// TODO: Convert to jsfile with @ts-check enabled. This approach would be better for cli programs
import yargs from "yargs-parser";
import path from "path";
import { startApp } from "./app";
import { reporters } from "./utils";

// TODO: Use args parser instead of heavyweight nconf

type Config = {
    _: string[];
    h?: boolean;
    help?: boolean;
    project?: string; // Path to project's tsconfig
    p?: string;
    verbose?: boolean;
    update?: boolean;
    remaining?: boolean;
    js?: boolean;
    // TOOD: Rename --update to --addFiles ?
};

const conf: Config = yargs(process.argv.slice(2));
if (conf.h || conf.help || conf._.length === 0) {
    process.stdout.write("Usage: tscfc --project TSCONFIG_PATH SRC_PATH\n");
    process.stdout.write("\n");
    process.stdout.write("Example: tscfc ./index.ts --project ../App/tsconfig.strict.json ../App/src\n");
    process.stdout.write("\n");
    process.stdout.write("\t--project -p\tpath to your tsconfig.json\n");
    process.stdout.write("\t--verbose\tprint all logs, usefull for debugging\n");
    process.stdout.write("\t--update\tinclude successfiles to tsconf\n");
    process.stdout.write("\t--remaining\tprint all remaining files");
    // TODO: Finish --js
    process.exit(0);
}

let isVerbose: boolean;

/**
 * DEFINITIONS
 */

function verbose(msg: string) {
    if (isVerbose) {
        console.debug(msg);
    }
}

/**
 * Main
 */

if (conf.verbose) {
    isVerbose = true;
}

// TODO: If not defined, try to find nearest tsconfig.json in CWD using ts.findConf. Inform user about that
if (conf.project !== undefined && conf.p !== undefined) {
    reporters.throwError('MISSING_PROJECT', 'You forget to pass project path as --project');
}

if (conf._.length === 0) {
    reporters.throwError('MISSING_SRC_PATH', 'You forget to pass path to inputFiles');
} else {
    startApp({
        shouldShowRemainings: conf.remaining,
        shouldUpdateFiles: conf.update,
        absSrcPath: path.resolve(conf._[0]),
        absTSConfPath: path.resolve(conf.project || conf.p)
    });
}
