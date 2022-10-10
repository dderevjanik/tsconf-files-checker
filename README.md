# Tsconf Files Checker

A small CLI utility that helps with incrementally converting your project to typescript
or to incrementally apply new rules (strictNullChecks, noImplicitAny, etc...) to existing typescript project

## Flow

- First `tscfc` run will output files without errors
- Command `tscfc --update` include files without errors files to tsconf
- After that, each `tscfc --update` checks files against tsconf files (from step 2.) and show user if anything is broken
        - If there are files without error, tscfc will include them to tsconf
        - If there are broken files (files that are already in tsconf have errors), it will output errors and exit code 1 (fail tests)

## Installation

```sh
npm i -D tscfc
```

## Example

Run from terminal:

```
Usage: tscfc --project TSCONFIG_PATH SRC_PATH

Example: tscfc ./index.ts --project ../App/tsconfig.strict.json ../App/src

        --project       path to your tsconfig.json
        --verbose       print all logs, usefull for debugging
        --update        include successfiles to tsconf
        --remaining     print all remaining files
```

*Note: In order to check javascript files, please include `allowJS: true` to tsconfig.*

## Recommended Settings

If you want to incrementally enforce some rules (e.g. noImplicitAny, strictNullChecks) create
`tsconfig.strict.json` alongside with your `tsconfig.json`. Then add to `tsconfig.strict.json`:

```json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "noImplicitAny": true,
    "strictNullChecks": true
  }
}
```

in `package.json` add `pretest` script, which will automatically runs
before your test, to check if you broke something or not, even before test.

```json
{
  //...
  "scripts": {
    "pretest": "tscfc --project ./tsconfig.strict.json ./src"
  }
  //...
}
```
