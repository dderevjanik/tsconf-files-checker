import ts from "typescript";
import path from "path";
import fs from "fs";
import { writeFileSync } from "fs";
import { reporters, colors } from "./utils";

export interface AppConf {
    shouldUpdateFiles: boolean;
    shouldShowRemainings: boolean;
    absTSConfPath: string;
    absSrcPath: string;
}

/**
 * @param absTSFilesPaths files to be checked
 * @param tsConfOptions with tsconf
 */
function checkFilesWithTSOptions(absTSFilesPaths: string[], tsConfOptions: ts.CompilerOptions) {
    // Obey 'node_modules/' files
    const nodeModulesRE = new RegExp(/node_modules/);
    const absolutePathsWithoutNodeModules = absTSFilesPaths
        .filter(f => !nodeModulesRE.test(f))
        .map(f => path.resolve(f));

    const tsProgram = ts.createProgram(absolutePathsWithoutNodeModules, tsConfOptions);

    const errorFiles: { [fileName: string]: ts.Diagnostic[] } = {};
    // TODO: Also add Syntactic diagnostics
    const diagnostics = tsProgram.getSemanticDiagnostics();
    diagnostics.forEach((dg) => {
        if (dg.code) {
            // File has error
            const filename = dg.file!.fileName;
            if (absTSFilesPaths.includes(filename)) {
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
 * @param absTSConfPath absolute path to tsconf
 */
function parseTSConfig(absTSConfPath: string) {
    const absTSConfDirName = path.dirname(absTSConfPath);
    const absTSConfFileName = path.basename(absTSConfPath);

    if (fs.existsSync(absTSConfPath)) {
        let file: Buffer;
        try {
            console.log(`Reading tsconfig '${absTSConfPath}'`);
            file = fs.readFileSync(absTSConfPath);
        } catch (err) {
            return reporters.throwError('CANNOT_READ_TSCONFIG', `Cannot read provided project path '${absTSConfPath}'. Make sure that project path is correct`);
        }
        const tsconfJSON = ts.parseConfigFileTextToJson(absTSConfFileName, file!.toString());
        if (tsconfJSON.error) {
            // For example, if json has comments, parse will throw an error
            return reporters.throwError('CANNOT_PARSE_TSCONFIG', `Cannot parse provided project '${absTSConfPath}'. Make sure that tsconfig is valid config`);
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
        return reporters.throwError('NON_EXISTS_PROJECT_PATH', `Provided project path '${absTSConfPath}' doesn't exists. Make sure that project path is correct`);
    }
}

// TODO: Remove this function and use ts.sys.readDirectory(path, [".ts"])
function globFiles(dir: string): string[] {
    const files = ts.sys.readDirectory(dir, [".ts"]);
    return files;
}

export function startApp(conf: AppConf): void {
    const absTSConfDirName = path.dirname(conf.absTSConfPath);
    const tsconfName = path.basename(conf.absTSConfPath);

    const tsconfOptions = parseTSConfig(conf.absTSConfPath);
    const filesToCheck = globFiles(conf.absSrcPath);
    if (filesToCheck.length === 0) {
        // TODO: Should throw an error ?
        reporters.throwError('NO_FILES_TO_ANALYZE', `There are no typescript files in '${conf.absSrcPath}'`);
    }

    console.log(`Analyzing ${filesToCheck.length} typescript files ...`);
    const { successFiles, errorFiles } = checkFilesWithTSOptions(filesToCheck, tsconfOptions.tsconfParsed.options);

    const newFilesToBeIncluded = successFiles.filter(f => !tsconfOptions.absTSConfFiles.includes(f));
    const brokenFiles = Object.keys(errorFiles).filter(f => tsconfOptions.absTSConfFiles.includes(f));
    const remainingFiles = filesToCheck.filter(f => !brokenFiles.includes(f) && !successFiles.includes(f));

    // verbose(`--- Files Ok: ${successFiles.length} ---`);
    // verbose(successFiles.map(p => path.relative(absTsconfDirName, p)).join('\n'));
    // verbose(`--- Files with errors: ${errorFiles.size} ---`);
    // verbose(Object.keys(errorFiles).map(p => path.relative(absTsconfDirName, p)).join('\n'));

    if (newFilesToBeIncluded.length) {
        // TODO: if update, change include to INCLUDED
        console.log(`\nInclude ${newFilesToBeIncluded.length} file(s) to '${tsconfName}'`);
        newFilesToBeIncluded.forEach(nf => {
            console.log(colors.yellow(path.relative(absTSConfDirName, nf)));
        });
    }

    if (conf.shouldShowRemainings) {
        // TODO: Check if (files.length === successFiles) and print it out
        console.log(`Remaining ${filesToCheck.length - newFilesToBeIncluded.length - tsconfOptions.absTSConfFiles.length}/${filesToCheck.length} files to be fixed`);
        console.log(remainingFiles.map(p => `\t${path.relative(absTSConfDirName, p)}`).join('\n'));
    }

    if (brokenFiles.length) {
        console.log(`Found errors in ${brokenFiles.length} file(s)`);
        brokenFiles.forEach(bf => {
            const errors = errorFiles[bf];
            const fileRelPath = path.relative(absTSConfDirName, bf);
            reporters.reportFileCheck(fileRelPath, errors);
        });
    }

    if (conf.shouldUpdateFiles && newFilesToBeIncluded.length) {
        newFilesToBeIncluded.forEach(f => {
            const relPath = path.relative(conf.absTSConfPath, f);
            tsconfOptions.tsconfJSON.config.files.push(relPath);
        });
        writeFileSync(conf.absTSConfPath, JSON.stringify(tsconfOptions.tsconfJSON.config, null, 2));
    }

    if (brokenFiles.length) {
        process.exit(1);
    }
    process.exit(0);
}
