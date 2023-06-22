# Document Control / Repository Information

| Item         | Value                                             |
|--------------|---------------------------------------------------|
| Owner        | Christian Kaltenbach, Vladimir Arsov              |
| Team         | none yet                                          |
| Project      | none                                              |
| Parent       | none                                              |
| Developed by | collaboration Factory AG                          |
| Description  | Our commandline utility to work with cplace code  |

# cplace CLI tools

![](https://github.com/collaborationFactory/cplace-npm-tools/workflows/Continuous%20Integration/badge.svg)

This package provides some CLI tools for working with cplace code.

## Usage

The user documentation for cplace CLI is located [in the Knowledge Base.](https://docs.cplace.io/cplace-cli/)

## Development

Before you can work with the repository, you need to install node modules once:

```bash
npm install
```

Typescript is compiled and linted by running:

```bash
npm run dev
```

This will execute both tslint (`npm run dev:lint`) as well as run the Typescript compiler (`npm run dev:tsc`).

To test your local changes with `cplace-cli` on the command line you have to `link` your local npm package by running:

```bash
npm link
```

This will first recompile the Typescript sources and do the linting before setting up and linking the binary executable.
When `npm link` is completed, you can just use `cplace-cli` as usual to test it out.
When the installation failed because `cplace-cli` was already installed, you can either remove it by running `npm r -g @cplace/cli`, or run `npm link --force`.

> Remember to clean your local linked package after testing by running `npm r -g @cplace/cli` to remove it and do a regular install again (`npm i -g @cplace/cli`).

To execute the available unit tests run:

```bash
npm run test
```

## Publishing a new version

To publish a new version on the NPM registry take the following steps:

1. Manually bump the version number in `package.json` as desired (major / minor / patch).
2. Push the update to GitHub.
3. Create a new Release on GitHub:
   1. Create _a new tag_ matching the version you want to publish, e.g. `v0.20.3`.
   2. Put in the proper release notes as description of the Release.
4. On creating the Release (_not as a draft_) the GitHub workflow will run and publish the package to NPM automatically.
