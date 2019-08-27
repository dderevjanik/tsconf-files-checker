import ts from "typescript";
import path from "path";

export function checkFiles(inputFileNames: string[], options: ts.CompilerOptions) {
    // Obey 'node_modules/' files
    const nodeModulesRE = new RegExp(/node_modules/);
    const absolutePathsWithoutNodeModules = inputFileNames
        .filter(f => !nodeModulesRE.test(f))
        .map(f => path.resolve(f));
    // verbose(`Skipped ${inputFileNames.length - absolutePathsWithoutNodeModules.length} node_modules files`);
    // verbose(`Runnig program against ${absolutePathsWithoutNodeModules.length} .ts files`);

    const program = ts.createProgram(absolutePathsWithoutNodeModules, options);
    const errorFiles: { [fileName: string]: ts.Diagnostic[] } = {};
    const diagnostics = program.getSemanticDiagnostics();
    diagnostics.forEach((dg) => {
        if (dg.code) {
            // File has error
            const filename = dg.file!.fileName;
            if (inputFileNames.includes(filename)) {
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
