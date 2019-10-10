import ts from "typescript";
import path from "path";
import fs, { existsSync } from "fs";
import { writeFileSync } from "fs";
import { reporters, colors, AbsPath, RelPath } from "./utils";

export interface AppConf {
    shouldUpdateFiles: boolean;
    shouldShowRemainings: boolean;
    tsconfPath: AbsPath;
    srcPath: AbsPath;
}

/**
 * @param tsFilesPath files to be checked
 * @param tsConfOptions with tsconf
 */
function checkFilesWithTSOptions(tsFilesPath: AbsPath[], tsConfOptions: ts.CompilerOptions) {
    // Obey 'node_modules/' files
    const nodeModulesRE = new RegExp(/node_modules/);
    const absolutePathsWithoutNodeModules = tsFilesPath
        .filter(f => !nodeModulesRE.test(f))
        .map(f => path.resolve(f));

    const tsProgram = ts.createProgram(absolutePathsWithoutNodeModules, tsConfOptions);

    const errorFiles: { [fileName: string]: ts.Diagnostic[] } = {};
    // TODO: Also add Syntactic diagnostics
    const diagnostics = tsProgram.getSemanticDiagnostics();
    diagnostics.forEach((dg) => {
        if (dg.code) {
            // File has error
            const filename = dg.file!.fileName as AbsPath;
            if (tsFilesPath.includes(filename)) {
                // File is in inputFiles
                if (filename in errorFiles) {
                    const prevErrors = errorFiles[filename];
                    errorFiles[filename] = [...prevErrors, dg];
                } else {
                    errorFiles[filename] = [dg];;
                }
            }
        }
    });
    const successFiles = absolutePathsWithoutNodeModules.filter((filePath) => !(filePath in errorFiles));

    return {
        successFiles,
        errorFiles
    };
}

/**
 * @param tsconfPath absolute path to tsconf
 */
function parseTSConfig(tsconfPath: AbsPath) {
    const absTSConfDirName = path.dirname(tsconfPath);
    const absTSConfFileName = path.basename(tsconfPath);

    if (fs.existsSync(tsconfPath)) {
        let file: Buffer;
        try {
            file = fs.readFileSync(tsconfPath);
        } catch (err) {
            return reporters.throwError('CANNOT_READ_TSCONFIG', `Cannot read provided project path '${tsconfPath}'. Make sure that project path is correct`);
        }
        const tsconfJSON = ts.parseConfigFileTextToJson(absTSConfFileName, file!.toString());
        if (tsconfJSON.error) {
            // For example, if json has comments, parse will throw an error
            return reporters.throwError('CANNOT_PARSE_TSCONFIG', `Cannot parse provided project '${tsconfPath}'. Make sure that tsconfig is valid config`);
        }
        const parsedTSConf = ts.parseJsonConfigFileContent(tsconfJSON.config, ts.sys, absTSConfDirName, undefined, absTSConfFileName);
        const tsconfFiles = tsconfJSON.config.files
            ? tsconfJSON.config.files.map(relPath => path.resolve(absTSConfDirName, relPath))
            : [];
        return {
            absTSConfFiles: tsconfFiles,
            tsconfParsed: parsedTSConf,
            tsconfJSON: tsconfJSON
        };
    } else {
        return reporters.throwError('NON_EXISTS_PROJECT_PATH', `Provided project path '${tsconfPath}' doesn't exists. Make sure that project path is correct`);
    }
}

// TODO: Remove this function and use ts.sys.readDirectory(path, [".ts"])
function globFiles(dir: string): string[] {
    const files = ts.sys.readDirectory(dir, [".ts"]);
    return files;
}

function generateReport({
    allFiles,
    tsconfFiles,
    successFiles,
    errorFiles,
}: {
    allFiles: AbsPath[],
    tsconfFiles: string[],
    successFiles: string[],
    errorFiles: string[]
}) {
    const newFilesToBeIncluded = successFiles.filter(f => !tsconfFiles.includes(f)) as AbsPath[];
    const brokenFiles = errorFiles.filter(f => tsconfFiles.includes(f));
    const remainingFiles = allFiles.filter(f => !brokenFiles.includes(f) && !successFiles.includes(f));
    return {
        newFilesToBeIncluded,
        brokenFiles,
        remainingFiles
    };
}

function updateTSConf(tsconfPath: AbsPath, conf: any, filenames: AbsPath[]) {
    const absDirName = path.dirname(tsconfPath);
    if (!existsSync(tsconfPath)) {
        reporters.throwError('TSCONF_NOT_EXISTS', `Provided path '${tsconfPath}' for tsconf doesn't exists`);
    }
    if (conf.files === undefined) {
        conf.files = [];
    }
    filenames.forEach(absPath => {
        const relPath = path.relative(absDirName, absPath) as RelPath;
        if (!conf.files.includes(relPath)) {
            conf.files.push(relPath);
        }
    });
    writeFileSync(tsconfPath, JSON.stringify(conf, null, 2));
}

export function startApp(conf: AppConf): void {
    const absTSConfDirName = path.dirname(conf.tsconfPath);
    const tsconfName = path.basename(conf.tsconfPath);

    console.log("Parsing TSConf");
    const tsconfOptions = parseTSConfig(conf.tsconfPath);

    console.log("Globing all files from src");
    const filesToCheck = globFiles(conf.srcPath) as AbsPath[];
    if (filesToCheck.length === 0) {
        // TODO: Should throw an error ?
        reporters.throwError('NO_FILES_TO_ANALYZE', `There are no typescript files in '${conf.srcPath}'`);
    }

    console.log(`Analyzing ${filesToCheck.length} typescript files ...`);
    const { successFiles, errorFiles } = checkFilesWithTSOptions(filesToCheck, tsconfOptions.tsconfParsed.options);

    console.log("Generating report");
    const report = generateReport({
        allFiles: filesToCheck,
        tsconfFiles: tsconfOptions.absTSConfFiles,
        errorFiles: Object.keys(errorFiles),
        successFiles: successFiles
    })
    // const newFilesToBeIncluded = successFiles.filter(f => !tsconfOptions.absTSConfFiles.includes(f));
    // const brokenFiles = Object.keys(errorFiles).filter(f => tsconfOptions.absTSConfFiles.includes(f));
    // const remainingFiles = filesToCheck.filter(f => !brokenFiles.includes(f) && !successFiles.includes(f));

    // verbose(`--- Files Ok: ${successFiles.length} ---`);
    // verbose(successFiles.map(p => path.relative(absTsconfDirName, p)).join('\n'));
    // verbose(`--- Files with errors: ${errorFiles.size} ---`);
    // verbose(Object.keys(errorFiles).map(p => path.relative(absTsconfDirName, p)).join('\n'));

    if (report.newFilesToBeIncluded.length) {
        // TODO: if update, change include to INCLUDED
        if (conf.shouldUpdateFiles) {
            console.log(`\nAdding ${report.newFilesToBeIncluded.length} files(s) to '${tsconfName}'`);
        } else {
            console.log(`\nInclude ${report.newFilesToBeIncluded.length} file(s) to '${tsconfName}'`);
        }
        report.newFilesToBeIncluded.forEach(nf => {
            console.log(colors.yellow(path.relative(absTSConfDirName, nf)));
        });
    }

    if (conf.shouldShowRemainings) {
        // TODO: Check if (files.length === successFiles) and print it out
        console.log(`Remaining ${filesToCheck.length - report.newFilesToBeIncluded.length - tsconfOptions.absTSConfFiles.length}/${filesToCheck.length} files to be fixed`);
        console.log(report.remainingFiles.map(p => `\t${path.relative(absTSConfDirName, p)}`).join('\n'));
    }

    if (report.brokenFiles.length) {
        console.log(`Found errors in ${report.brokenFiles.length} file(s)`);
        report.brokenFiles.forEach(bf => {
            const errors = errorFiles[bf];
            const fileRelPath = path.relative(absTSConfDirName, bf);
            reporters.reportFileCheck(fileRelPath, errors);
        });
    }

    if (conf.shouldUpdateFiles && report.newFilesToBeIncluded.length) {
        updateTSConf(conf.tsconfPath, tsconfOptions.tsconfJSON.config, report.newFilesToBeIncluded);
        // report.newFilesToBeIncluded.forEach(f => {
        //     const relPath = path.relative(conf.absTSConfPath, f);
        //     tsconfOptions.tsconfJSON.config.files.push(relPath);
        // });
        // writeFileSync(conf.absTSConfPath, JSON.stringify(tsconfOptions.tsconfJSON.config, null, 2));
    }

    if (report.brokenFiles.length) {
        process.exit(1);
    }
    process.exit(0);
}
