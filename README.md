# cplace CLI tools

This package provides some CLI tools for working with cplace code.

## Usage

This package should be installed globally:
```
# Fetches the latest release from a repo
$ npm install -g @cplace/cli
# Or clone this repo, build it and install the latest development version:
$ npm install && gulp
$ npm install -g .
```

After installation you can just execute:
```
$ cplace-cli
```
to get the available commands and help.

=======
## Building and Running 

Building is done via gulp, but dependencies must first be installed through npm (which also installs gulp if required):
```
$ npm install
$ gulp
```
After building, the local version can be run using node:
```
$ node dist/src/cli.js
```
