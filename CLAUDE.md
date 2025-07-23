# CLAUDE.md

## Overview

This guide outlines how to restructure the cplace-cli project into a monorepo architecture using modern tools like npm workspaces, Lerna, or pnpm. This structure provides better code organization, easier testing, and improved maintainability.


## Mission

- Migration to the commander cli framework. (https://www.npmjs.com/package/commander, Version 14.0.0).
- Remove outdated libraries like `meow` and others if sensible.
- Use the suggested mono repo structure.

### Commander typescript

Commander.js is a powerful library for building command-line interface tools with TypeScript.
It allows developers to create CLI tools with features such as options, commands, and arguments.

## Claude's Role

- You are a node.js typescript expert following best practices.
- Write production ready code.
- Concentrate on the existing core implementation.
- You transform the project but retain the curent business logic.

## Development Guidelines

### General

- **Never publish** any changes to the npm registry.
- When doing a git commit or push but use the globally configured git user as author.
- Do the migration in small steps, step by step. Always we want to review the plan for the changes before any actual changes are done. We will move and adopt files and business logic command by command, starting with the shared implementations.
- the original project structure in src and test must be retained during the migration as knowledge base but not be build and used anymore.

### Multi-Developer Collaboration

- **Three-developer parallel migration** strategy outlined in `MIGRATION_PLAN.md`
- **Developer assignments**: Infrastructure (Dev 1), Release Notes & Flow (Dev 2), Version & Visualize (Dev 3)
- **Critical path management**: Runtime module resolution must be completed before other developers can proceed
- **Daily coordination**: 15-minute morning syncs to manage dependencies and shared resources
- **Branch strategy**: Feature branches per developer with coordinated merge timing

### Code Quality Standards

1. **TypeScript Best Practices**: Strict typing, proper error handling
2. **node.js Compliance**:
  1. Follow official node.js specification
  2. Use eslint linting
  3. Use prettier to make sure the code is formatted correctly.

3. **General Coding Conventions**:
  1. Adhere to "separation of concerns"
  2. Always use type save approaches

4. **Testing**:
  1. Make sure existing Unit tests for all tools and handlers keep working or are updated properly after code and structure changes.
  2. Run required tests after modifications when sensible.


### Development Environment

- **Use Node.js v22.12.0** (specified in `.nvmrc` - use `nvm use` to switch)
- Use nx as build tool
- Use tsconfig
  - "target": "ES2022"
  - "module": "ESNext"
  - "moduleResolution": "Node"
  -  Required in each package.json: "type": "module"
- Shared npm modules shall be added in a parent package.json
- Shared tsconfig configurations shall be defined in a parent tsconfig.json


## Proposed Monorepo Structure

This is a **proposal** of the target structure:

```
cplace-npm-tools/
├── packages/
│   ├── cli/                          # Main CLI entry point
│   │   ├── src/
│   │   │   ├── index.ts
│   │   │   └── cli.ts
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   ├── core/                         # Shared core functionality
│   │   ├── src/
│   │   │   ├── index.ts
│   │   │   ├── Global.ts
│   │   │   ├── types/
│   │   │   │   ├── index.ts
│   │   │   │   └── commands.ts
│   │   │   └── utils/
│   │   │       ├── index.ts
│   │   │       ├── promiseHelpers.ts
│   │   │       └── fs.ts
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   ├── git-utils/                    # Git functionality
│   │   ├── src/
│   │   │   ├── index.ts
│   │   │   ├── Repository.ts
│   │   │   └── models.ts
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   ├── command-repos/                # Repos command package
│   │   ├── src/
│   │   │   ├── index.ts
│   │   │   ├── ReposCommand.ts
│   │   │   ├── subcommands/
│   │   │   │   ├── update.ts
│   │   │   │   ├── write.ts
│   │   │   │   ├── clone.ts
│   │   │   │   ├── branch.ts
│   │   │   │   ├── add-dependency.ts
│   │   │   │   ├── merge-skeleton.ts
│   │   │   │   ├── migrate-artifact.ts
│   │   │   │   └── validate-branches.ts
│   │   │   └── utils/
│   │   │       ├── ImlParser.ts
│   │   │       └── AbstractReposCommand.ts
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   ├── command-release-notes/        # Release notes command
│   │   ├── src/
│   │   │   ├── index.ts
│   │   │   ├── ReleaseNotesCommand.ts
│   │   │   ├── GenerateReleaseNotes.ts
│   │   │   ├── CheckMessages.ts
│   │   │   ├── MergeReleaseNotes.ts
│   │   │   └── ReleaseNotesMessagesFile.ts
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   ├── command-flow/                 # Flow command
│   │   ├── src/
│   │   │   ├── index.ts
│   │   │   ├── FlowCommand.ts
│   │   │   ├── Upmerge.ts
│   │   │   ├── UpmergeAnalyzer.ts
│   │   │   └── models.ts
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   ├── command-version/              # Version command
│   │   ├── src/
│   │   │   ├── index.ts
│   │   │   ├── VersionCommand.ts
│   │   │   └── RewriteVersions.ts
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   ├── command-visualize/            # Visualize command
│   │   ├── src/
│   │   │   ├── index.ts
│   │   │   ├── VisualizeCommand.ts
│   │   │   └── VisualizeDelegate.ts
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   │
│   └── helpers/                      # Shared helpers
│       ├── src/
│       │   ├── index.ts
│       │   ├── CplaceVersion.ts
│       │   └── GradleBuild.ts
│       ├── package.json
│       └── tsconfig.json
│
├── documentation/                    # Existing documentation
├── test/                            # Integration tests
├── package.json                     # Root package.json
├── tsconfig.json                   # Root TypeScript config
└── README.md
```

## Project Overview

This is `@cplace/cli`, a command-line utility for working with cplace code and repositories. It provides tools for release notes generation, repository management, visualization, refactoring, and end-to-end testing.

## Development Commands

### Core Development
```bash
# Install dependencies
npm install

# Development build (lint + compile TypeScript)
npm run dev

# Individual commands
npm run dev:lint    # ESLint check
npm run dev:tsc     # TypeScript compilation + set executable permissions

# Clean build artifacts
npm run clean

# Full prepare (clean + dev)
npm run prepare
```

### Testing
```bash
# Run all tests
npm test           # Uses Jest with ts-jest preset

# Test configuration is in jest.config.js
# - Test timeout: 1000 seconds (for long-running operations)
# - Supports TypeScript files via ts-jest
# - Tests located in src/ and test/ directories
```

### Local Development
```bash
# Link for local testing
npm run link       # Prepares and links the CLI globally

# After linking, test with:
cplace-cli --help

# Clean up local link
npm r -g @cplace/cli
```

## Architecture

### Command Structure
The CLI uses a command-based architecture where each major feature is a separate command:

- **Entry Point**: `src/cli.ts` - Main CLI entry using meow for argument parsing
- **Command Runner**: `src/commands/CommandRunner.ts` - Dispatches to registered commands
- **Commands**: Each command is in `src/commands/<command-name>/` directory
  - `release-notes` - Release notes generation and management
  - `repos` - Repository operations (update, clone, branch management)
  - `flow` - Upmerge operations between releases
  - `visualize` - Branch dependency visualization
  - `refactor` - Plugin refactoring utilities
  - `version` - Version management utilities

### Key Components
- **Global Configuration**: `src/Global.ts` - Handles global CLI parameters like `--verbose`
- **Git Operations**: `src/git/` - Git-related utilities and operations
- **Promise Utilities**: `src/promiseAllSettled.ts` - Bluebird Promise extensions
- **Helpers**: `src/helpers/` - Shared utility functions

### Dependencies Architecture
- Uses **Bluebird** for enhanced Promise handling
- **simple-git** for Git operations
- **meow** for CLI argument parsing
- **@inquirer/prompts** for interactive prompts
- **xml2js** for XML parsing (likely for cplace-specific configs)

## Important Files
- `parent-repos.json` - Repository dependency configuration
- `release-notes/messages_*.db` - Release notes message databases
- `version.gradle` - Version configuration files
- `MIGRATION_PLAN.md` - Three-developer migration coordination plan
- `CLAUDE.md` - This file with development guidelines

## Linting and Type Checking
- Uses ESLint with TypeScript support (`@typescript-eslint/*`)
- Configuration in `.eslintrc.json`
- TypeScript configuration in `tsconfig.json` (ES6 target, CommonJS modules)

## Testing Notes
- Jest with ts-jest preset for TypeScript support
- Very long test timeout (1000s) - indicates complex integration tests
- Tests can be in both `src/` (alongside code) and `test/` directories
