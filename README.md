# cplace CLI tools

This package provides some CLI tools for working with cplace code.

## Usage

This package should be installed globally:
```
# Fetches the latest release from a repo
$ npm install -g @cplace/cli

# Or clone this repo, build it and install the latest development version:
$ npm install && npm run prod
$ npm install -g .
```

After installation you can just execute:
```
$ cplace-cli
```
to get the available commands and help.

## Building and Running 

Building is done via npm package commands, but dependencies must first be installed through npm:
```
$ npm install
$ npm run prod
```
After building, the local version can be run using node:
```
$ node dist/cli.js
```
In order to just run the TypeScript compiler and tslint use:
```
$ npm run dev
```
