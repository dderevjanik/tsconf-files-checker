# Tsconf Files Checker

A small CLI utility that helps with incrementally converting your project to TypeScript or to incrementally apply new rules (strictNullChecks, noImplicitAny, etc.) to an existing TypeScript project.

## Flow

1. The first `tscfc` run will output files without errors.
2. Command `tscfc --update` includes files without errors to `tsconfig`.
3. After that, each `tscfc --update` checks files against `tsconfig` files (from step 2) and shows the user if anything is broken:
   - If there are files without errors, `tscfc` will include them in `tsconfig`.
   - If there are broken files (files that are already in `tsconfig` have errors), it will output errors and exit with code 1 (fail tests).

## Installation

```sh
npm i -D tscfc
```

## Example

Run from the terminal:

```
Usage: tscfc --project TSCONFIG_PATH SRC_PATH

Example: tscfc ./index.ts --project ../App/tsconfig.strict.json ../App/src

        --project       Path to your tsconfig.json
        --verbose       Print all logs, useful for debugging
        --update        Include successful files to tsconfig
        --remaining     Print all remaining files
```

_Note: In order to check JavaScript files, please include `allowJs: true` in tsconfig._

## Recommended Settings

If you want to incrementally enforce some rules (e.g., noImplicitAny, strictNullChecks), create `tsconfig.strict.json` alongside your `tsconfig.json`. Then add to `tsconfig.strict.json`:

```json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "noImplicitAny": true,
    "strictNullChecks": true
  }
}
```

In `package.json`, add a `pretest` script, which will automatically run before your tests to check if you broke something or not, even before the test.

```json
{
  "scripts": {
    "pretest": "tscfc --project ./tsconfig.strict.json ./src"
  }
}
```
