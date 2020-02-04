# Tsconf Files Checker

A small CLI utility that helps with incrementally converting your project to typescript
or for adding new rules (strictNullChecks, noImplicitAny, etc...) to existing typescript project

## Flow

- 1. First `tscfc` run will output files without errors
- 2. Command `tscfc --update` will automatically include those files to tsconf
- 3. After that, each `tscfc --update` checks files against tsconf files (from step 2.) and show user if anything is broken
        - 3.1. If there are no broken files, then Ok. User's changes didn't affect any files in tsconf
        - 3.2. If there are files without error, tscfc will add them to tsconf.
        - 3.3. If there are broken files (files in tsconf now have errors), it will output errors and exit code 1 (fail tests)

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

in package json add `pretest` script, which will automatically runs
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
