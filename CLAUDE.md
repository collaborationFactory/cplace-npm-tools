# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Mission

Migration from bluebird to native promises.

## Claude's Role

- You are a node.js typescript expert following best practices.
- Write production ready code.
- Concentrate on the existing core implementation.

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

## Linting and Type Checking
- Uses ESLint with TypeScript support (`@typescript-eslint/*`)
- Configuration in `.eslintrc.json`
- TypeScript configuration in `tsconfig.json` (ES6 target, CommonJS modules)

## Testing Notes
- Jest with ts-jest preset for TypeScript support
- Very long test timeout (1000s) - indicates complex integration tests
- Tests can be in both `src/` (alongside code) and `test/` directories

## Development Guidelines

### Code Quality Standards

1. **TypeScript Best Practices**: Strict typing, proper error handling
2. **node.js Compliance**: Follow official node.js specification
3. **General Coding Conventions**: Adhere to "separation of concerns"
4. **Testing**: Make sure existing Unit tests for all tools and handlers keep working or are updated properly after code changes
