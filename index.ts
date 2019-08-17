// TODO: Convert to jsfile with @ts-check enabled. This approach would be better for cli programs
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
    // TODO: Add --update
    process.exit(0);
}

let verbose: boolean;

function check(inputFileNames: string[], options: ts.CompilerOptions) {
    // Obey 'node_modules/' files
    const nodeModulesRE = new RegExp(/node_modules/);
    const absolutePathsWithoutNodeModules = inputFileNames
        .filter(f => !nodeModulesRE.test(f))
        .map(f => path.resolve(f));
    console.log(`skip ${inputFileNames.length - absolutePathsWithoutNodeModules.length} node_modules files`);
    console.log(`runnig program against ${absolutePathsWithoutNodeModules.length} .ts files`);
    const program = ts.createProgram(absolutePathsWithoutNodeModules, options);

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
    const successFiles = absolutePathsWithoutNodeModules.filter((filePath) => !errorFiles.has(filePath));

    // TODO: Print files path relative to passed tsconfig dirname
    return {
        successFiles,
        errorFiles
    };
}

(async function() {
    let tsconf: any;
    let tsconfDirName: string;

    if (conf.verbose) {
        verbose = true;
    }

    // TODO: If not defined, try to find nearest tsconfig.json in CWD using ts.findConf. Inform user about that
    if (conf.project !== undefined) {
        console.log('checking existence of tsconfig');
        if (fs.existsSync(conf.project)) {
            let file;
            try {
                console.log('reading tsconfig');
                file = fs.readFileSync(conf.project);
                tsconfDirName = path.dirname(conf.project);
            } catch(err) {
                throw new Error('CANNOT_READ_TSCONFIG');
            }
            console.log('parsing tsconfig');
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
        console.log('applying glob patter to find all .ts files in project');
        glob(path.resolve(conf._[0], '**' ,'*.ts'), (err, files) => {
            if (err) {
                throw new Error('GLOB_ERROR');
            }
            console.log(`found ${files.length} files in project`);
            const { successFiles, errorFiles } = check(files, tsconf.config);
            console.log(`successFiles count: ${successFiles.length}`);
            console.log(`errorFiles count: ${errorFiles.size}`);
            // console.log(successFiles.map(p => path.relative(tsconfDirName, p)));
            // console.log(errorFiles.map(p => path.relative(tsconfDirName, p)));
            process.exit(0);
        });
    }
})();
