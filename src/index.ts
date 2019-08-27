#!/usr/bin/env node

// TODO: Convert to jsfile with @ts-check enabled. This approach would be better for cli programs
import * as ts from "typescript";
import nconf from "nconf";
import fs, { writeFileSync } from "fs";
import glob from "glob";
import path from "path";

import { throwError, reportFileCheck, yellow } from "./reporter";
import { checkFiles } from "./check-files";

/// CLI

const config = {};

type Config = (typeof config) & {
    _: string[];
    h?: boolean;
    help?: boolean;
    project?: string; // Path to project's tsconfig
    verbose?: boolean;
    update?: boolean;
    js?: boolean;
    // TODO: Add --update, which automatically update tsconfig with successFiles
};

const conf = nconf
    .argv()
    .defaults(config)
    .get() as Config;

if (conf.h || conf.help || conf._.length === 0) {
    process.stdout.write("Usage: ts-node --project TSCONFIG_PATH SRC_PATH\n");
    process.stdout.write("\n");
    process.stdout.write("Example: ts-node ./index.ts --project ../App/tsconfig.strict.json ../App/src\n");
    process.stdout.write("\n");
    process.stdout.write("\t--project\tpath to your tsconfig.json\n");
    process.stdout.write("\t--verbose\tprint all logs, usefull for debugging\n");
    process.stdout.write("\t--update\include successfiles to tsconf\n");
    // TODO: Finish --js
    // TODO: Add --update
    process.exit(0);
}

let isVerbose: boolean;

/// DEFINITIONS

function verbose(msg: string) {
    if (isVerbose) {
        console.debug(msg);
    }
}

/// MAIN

(async function () {
    let tsconf: any;
    let absTsconfPath: string;
    let absTsconfDirName: string;
    let tsconfFiles: string[];

    if (conf.verbose) {
        isVerbose = true;
    }

    verbose(JSON.stringify(conf, null, 2));
    // TODO: If not defined, try to find nearest tsconfig.json in CWD using ts.findConf. Inform user about that
    if (conf.project !== undefined) {
        verbose('Checking existence of tsconfig');
        absTsconfPath = path.resolve(conf.project);
        if (fs.existsSync(conf.project)) {
            let file: Buffer;
            try {
                console.log(`Reading tsconfig '${absTsconfPath}'`);
                file = fs.readFileSync(conf.project);
                absTsconfDirName = path.dirname(absTsconfPath);
            } catch (err) {
                throwError('CANNOT_READ_TSCONFIG', `Cannot read provided project path '${conf.project}'. Make sure that project path is correct`);
            }
            verbose('Parsing tsconfig');
            tsconf = ts.parseConfigFileTextToJson('test', file!.toString());
            tsconfFiles = tsconf.config.files
                ? tsconf.config.files.map(p => path.resolve(absTsconfDirName, p)) // Get absolute path of files
                : [];
            // NOTE: Because tsconfig.json can have comments, JSON.parse() will throw errors
            if (tsconf.error) {
                throwError('CANNOT_PARSE_TSCONFIG', `Cannot parse provided project '${conf.project}'. Make sure that tsconfig is valid config`);
            }
        } else {
            throwError('NON_EXISTS_PROJECT_PATH', `Provided project path '${conf.project}' doesn't exists. Make sure that project path is correct`);
        }
    } else {
        throwError('MISSING_PROJECT', 'You forget to pass project path as --project');
    }

    if (conf._.length === 0) {
        throwError('MISSING_SRC_PATH', 'You forget to pass path to inputFiles');
    } else {
        verbose('Applying glob pattern to find all .ts files in project');
        glob(path.resolve(conf._[0], '**', '*.ts'), (err, files) => {
            if (err) {
                throwError('GLOB_ERROR', `Error during glob ${err}`);
            }
            if (files.length === 0) {
                throwError('NO_FILES_TO_ANALYZE', `There are no typescript files in '${conf._[0]}'`);
            }
            console.log(`Analyzing ${files.length} typescript files ...`);
            const { successFiles, errorFiles } = checkFiles(files, tsconf.config.compilerOptions);

            const newFilesToBeIncluded = successFiles.filter(f => !tsconfFiles.includes(f));
            const brokenFiles = Object.keys(errorFiles).filter(f => tsconfFiles.includes(f));
            const remainingFiles = files.filter(f => !brokenFiles.includes(f) && !successFiles.includes(f));

            // verbose(`--- Files Ok: ${successFiles.length} ---`);
            // verbose(successFiles.map(p => path.relative(absTsconfDirName, p)).join('\n'));
            // verbose(`--- Files with errors: ${errorFiles.size} ---`);
            // verbose(Object.keys(errorFiles).map(p => path.relative(absTsconfDirName, p)).join('\n'));

            console.log(`Include new files (${newFilesToBeIncluded.length}) to tsconf`);
            newFilesToBeIncluded.forEach(nf => {
                console.log(yellow(path.relative(absTsconfDirName, nf)));
            });

            console.log(`Remaining ${files.length - newFilesToBeIncluded.length - tsconfFiles.length}/${files.length} files to be fixed`);
            verbose(remainingFiles.map(p => `\t${path.relative(absTsconfDirName, p)}`).join('\n'));

            if (brokenFiles.length) {
                brokenFiles.forEach(bf => {
                    const errors = errorFiles[bf];
                    const fileRelPath = path.relative(absTsconfDirName, bf);
                    reportFileCheck(fileRelPath, errors);
                });
                console.log(`Found errors in ${brokenFiles.length} files`);
            }

            if (conf.update && newFilesToBeIncluded.length) {
                newFilesToBeIncluded.forEach(f => {
                    const relPath = path.relative(absTsconfDirName, f);
                    tsconf.config.files.push(relPath);
                });
                writeFileSync(absTsconfPath, JSON.stringify(tsconf.config, null, 2));
            }

            // console.log(successFiles.map(p => path.relative(tsconfDirName, p)));
            // console.log(errorFiles.map(p => path.relative(tsconfDirName, p)));
            if (brokenFiles.length) {
                process.exit(1);
            }
            process.exit(0);
        });
    }
})();
