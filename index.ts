// TODO: Add more meaningful errors with explanation
import * as ts from "typescript";
import nconf from "nconf";
import fs from "fs";
import glob from "glob";
import path from "path";

const config = { };

type Config = (typeof config) & {
    _: string[];
    h?: boolean;
    help?: boolean;
    project?: string; // Path to tsconfig
    // TODO: Add --update, which automatically update tsconfig with successFiles
    // TODO: Add --verbose
};

const conf = nconf
    .argv()
    .defaults(config)
    .get() as Config;

if (conf.h || conf.help || conf._.length === 0) {
    process.stdout.write("Usage: ts-node --project TSCONFIG_PATH SRC_PATH\n");
    process.stdout.write("\n");
    // TODO: Add example
    process.exit();
}

function check(inputFileNames: string[], options: ts.CompilerOptions): void {
    const absolutePaths = inputFileNames.map(f => path.resolve(f));
    const program = ts.createProgram(absolutePaths, options);

    const errorFiles = new Set<string>();
    const diagnostics = program.getSemanticDiagnostics();
    diagnostics.forEach((dg) => {
        if (dg.code) {
            // File has error
            if (inputFileNames.includes(dg.file!.fileName)) {
                // File is in inputFiles
                errorFiles.add(dg.file!.fileName);
            }
        }
    });
    const successFiles = inputFileNames.filter((filePath) => !errorFiles.has(filePath));

    console.log('success', successFiles);
    console.log('errors', errorFiles);
}

(async function() {
    let tsconf: any;

    // TODO: If not defined, try to find nearest tsconfig.json in CWD using ts.findConf
    if (conf.project !== undefined) {
        if (fs.existsSync(conf.project)) {
            let file;
            try {
                file = fs.readFileSync(conf.project);
            } catch(err) {
                throw new Error('CANNOT_READ_TSCONFIG');
            }
            tsconf = ts.parseConfigFileTextToJson('test', file.toString());
            // NOTE: Because tsconfig.json can have comments, JSON.parse() will throw errors
            if (tsconf.error) {
                throw new Error('CANNOT_PARSE_TSCONFIG');
            }
        } else {
            throw new Error('NON_EXISTS_PROJECT_PATH');
        }
    } else {
        throw new Error('MISSING_PROJECT');
    }

    if (conf._.length === 0) {
        throw new Error('MISSING_SRC_PATH');
    } else {
        glob(path.resolve(conf._[0], '**' ,'*.ts'), (err, files) => {
            if (err) {
                throw new Error('GLOB_ERROR');
            }
            check(files, tsconf.config);
            process.exit(0);
        });
    }
})();
