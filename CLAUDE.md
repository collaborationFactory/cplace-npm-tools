# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

Build and prepare the project:
```bash
npm run dev          # Lint and compile TypeScript
npm run dev:lint     # Run ESLint on all TypeScript files  
npm run dev:tsc      # Compile TypeScript and make dist/ executable
npm run prepare      # Clean + dev (full rebuild)
npm run clean        # Remove dist/ and *.tgz files
```

Testing:
```bash
npm test             # Run Jest unit tests
npm run test         # Same as above
```

Local development and testing:
```bash
npm link             # Link local package for testing (runs prepare first)
npm r -g @cplace/cli # Unlink/remove global package after testing
```

## Architecture Overview

This is a CLI tool (`@cplace/cli`) that provides utilities for working with cplace codebases. The main entry point is `src/cli.ts` which uses the `meow` library for CLI parsing and `CommandRunner` for command execution.

### Core Structure

- **`src/cli.ts`**: Main CLI entry point with help text and command parsing
- **`src/commands/CommandRunner.ts`**: Central command registry and execution logic
- **`src/commands/`**: Individual command implementations organized in subdirectories:
  - `release-notes/`: Generate and manage release notes from git commits
  - `repos/`: Multi-repository management (clone, update, branch creation)
  - `flow/`: Git flow operations (upmerge workflows)
  - `visualize/`: Repository dependency visualization  
  - `e2e/`: End-to-end test execution
  - `refactor/`: Code refactoring utilities
  - `version/`: Version management

### Key Commands

- **`release-notes`**: Generates release notes from git commit messages, supports multiple languages and merge conflict resolution
- **`repos`**: Manages parent repository dependencies defined in `parent-repos.json`, handles cloning, updating, and branching across multiple repositories
- **`flow --upmerge`**: Automated merging of changes up through release branches
- **`visualize`**: Creates dependency graphs of repository branches
- **`e2e`**: Runs end-to-end tests with Selenium WebDriver

### Command Pattern

All commands implement the `ICommand` interface with:
- `prepareAndMayExecute(params)`: Validation and setup
- `execute()`: Main command logic returning Promise\<void\>

Commands are registered in `REGISTERED_COMMANDS` object in `CommandRunner.ts`.

### Configuration Files

- **`parent-repos.json`**: Defines repository dependencies and versions (used by `repos` command)
- **`release-notes/messages_*.db`**: Release note message databases for different languages
- **`.git/config`**: Can include custom merge drivers for automatic conflict resolution

### Development Notes

- Uses TypeScript with ES6 target
- Jest for testing with 1000-second timeout for long-running operations
- ESLint with TypeScript support
- Bluebird for Promise handling
- Built binaries go to `dist/` with executable permissions
- Global installation creates `cplace-cli` binary