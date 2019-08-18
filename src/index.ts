// TODO: Convert to jsfile with @ts-check enabled. This approach would be better for cli programs
import * as ts from "typescript";
import nconf from "nconf";
import fs from "fs";
import glob from "glob";
import path from "path";

/// CLI

const config = {};

type Config = (typeof config) & {
    _: string[];
    h?: boolean;
    help?: boolean;
    project?: string; // Path to project's tsconfig
    verbose?: boolean;
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
    // TODO: Add --js to check also .js files
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

function printError(err: string, msg: string) {
    throw new Error(`ERROR: ${err}\n${msg}`);
}

function check(inputFileNames: string[], options: ts.CompilerOptions) {
    // Obey 'node_modules/' files
    const nodeModulesRE = new RegExp(/node_modules/);
    const absolutePathsWithoutNodeModules = inputFileNames
        .filter(f => !nodeModulesRE.test(f))
        .map(f => path.resolve(f));
    verbose(`Skipped ${inputFileNames.length - absolutePathsWithoutNodeModules.length} node_modules files`);
    verbose(`Runnig program against ${absolutePathsWithoutNodeModules.length} .ts files`);

    const program = ts.createProgram(absolutePathsWithoutNodeModules, options);
    const errorFiles = new Set<string>();
    const diagnostics = program.getSemanticDiagnostics();
    diagnostics.forEach((dg) => {
        if (dg.code) {
            // File has error
            if (inputFileNames.includes(dg.file!.fileName)) {
                // File is in inputFiles
                errorFiles.add(dg.file!.fileName);
                console.log(dg.messageText);
            }
        }
    });
    const successFiles = absolutePathsWithoutNodeModules.filter((filePath) => !errorFiles.has(filePath));

    return {
        successFiles,
        errorFiles
    };
}

/// MAIN

(async function () {
    let tsconf: any;
    let absTsconfPath: string;
    let absTsconfDirName: string;

    if (conf.verbose) {
        isVerbose = true;
    }

    // TODO: If not defined, try to find nearest tsconfig.json in CWD using ts.findConf. Inform user about that
    if (conf.project !== undefined) {
        verbose('Checking existence of tsconfig');
        absTsconfPath = path.resolve(conf.project);
        if (fs.existsSync(conf.project)) {
            let file: Buffer;
            try {
                verbose(`Reading tsconfig '${absTsconfPath}'`);
                file = fs.readFileSync(conf.project);
                absTsconfDirName = path.dirname(absTsconfPath);
            } catch (err) {
                printError('CANNOT_READ_TSCONFIG', `Cannot read provided project path '${conf.project}'. Make sure that project path is correct`);
            }
            verbose('Parsing tsconfig');
            tsconf = ts.parseConfigFileTextToJson('test', file!.toString());
            // NOTE: Because tsconfig.json can have comments, JSON.parse() will throw errors
            if (tsconf.error) {
                printError('CANNOT_PARSE_TSCONFIG', `Cannot parse provided project '${conf.project}'. Make sure that tsconfig is valid config`);
            }
        } else {
            printError('NON_EXISTS_PROJECT_PATH', `Provided project path '${conf.project}' doesn't exists. Make sure that project path is correct`);
        }
    } else {
        printError('MISSING_PROJECT', 'You forget to pass project path as --project');
    }

    if (conf._.length === 0) {
        printError('MISSING_SRC_PATH', 'You forget to pass path to inputFiles');
    } else {
        verbose('Applying glob pattern to find all .ts files in project');
        glob(path.resolve(conf._[0], '**', '*.ts'), (err, files) => {
            if (err) {
                printError('GLOB_ERROR', `Error during glob ${err}`);
            }
            verbose(`Found ${files.length} .ts files in project`);
            const { successFiles, errorFiles } = check(files, tsconf.config.compilerOptions);

            // check success and error files against tsconfig.json

            verbose(`--- SuccessFiles count: ${successFiles.length} ---`);
            verbose(successFiles.map(p => path.relative(absTsconfDirName, p)).join('\n'));
            verbose(`--- ErrorFiles count: ${errorFiles.size} ---`);
            verbose(Array.from(errorFiles).map(p => path.relative(absTsconfDirName, p)).join('\n'));
            // console.log(successFiles.map(p => path.relative(tsconfDirName, p)));
            // console.log(errorFiles.map(p => path.relative(tsconfDirName, p)));
            process.exit(0);
        });
    }
})();
