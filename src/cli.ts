#!/usr/bin/env node

// TODO: Convert to jsfile with @ts-check enabled. This approach would be better for cli programs
import yargs from "yargs-parser";
import path from "path";
import { startApp } from "./app";
import { reporters, AbsPath } from "./utils";
import { EError } from "./errors";

type Config = {
    _: string[];
    h?: boolean;
    help?: boolean;
    project?: string; // Path to project's tsconfig
    p?: string;
    r?: boolean;
    u?: boolean;
    update?: boolean;
    verbose?: boolean;
    remaining?: boolean;
    // TOOD: Rename --update to --addFiles ?
};

const conf: Config = yargs(process.argv.slice(2)) as any;
if (conf.h || conf.help || conf._.length === 0) {
    process.stdout.write("Usage: tscfc --project TSCONFIG_PATH SRC_PATH\n");
    process.stdout.write("\n");
    process.stdout.write("Example: tscfc ./index.ts --project ../App/tsconfig.strict.json ../App/src\n");
    process.stdout.write("\n");
    process.stdout.write("\t--project -p\tpath to your tsconfig.json\n");
    process.stdout.write("\t--update -u\tinclude successfiles to tsconf\n");
    process.stdout.write("\t--remaining -r\tprint all remaining files\n");
    process.stdout.write("\t--verbose\tverbose");
    // TODO: Finish --js
    process.exit(0);
}

/**
 * Main
 */

// TODO: If not defined, try to find nearest tsconfig.json in CWD using ts.findConf. Inform user about that
if (conf.project !== undefined && conf.p !== undefined) {
    reporters.throwError(EError.MISSING_PROJECT, 'You forget to pass project path as --project');
}

if (conf._.length === 0) {
    reporters.throwError(EError.MISSING_SRC_PATH, 'You forget to pass path to inputFiles');
} else {
    startApp({
        shouldShowRemainings: conf.remaining || conf.r || false,
        shouldUpdateFiles: conf.update || conf.u || false,
        srcPath: path.resolve(conf._[0]) as AbsPath,
        tsconfPath: path.resolve(conf.project || conf.p) as AbsPath,
        verbose: conf.verbose || false
    });
}
