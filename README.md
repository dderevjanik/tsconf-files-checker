# Tsconf Files Checker

A small CLI utility that helps with incrementally converting your project to typescript
or for adding new rules (strictNullChecks, noImplicitAny, etc...) to existing typescript project

Run from terminal:

```
Usage: tscfc --project TSCONFIG_PATH SRC_PATH

Example: tscfc ./index.ts --project ../App/tsconfig.strict.json ../App/src

        --project       path to your tsconfig.json
        --verbose       print all logs, usefull for debugging
        --update        include successfiles to tsconf
        --remaining     print all remaining files⏎
```
