# /commander-subcommands - Create Proper Subcommand Structure

You are refactoring CLI commands to use Commander.js subcommand structure instead of parameter-based command routing. Focus on creating proper command hierarchies with shared options and individual subcommand logic.

## Your Task

Convert single commands with multiple modes to proper Commander.js subcommands using `.command()` declarations. Transform parameter-based routing to structured subcommand hierarchies.

### Convert Parameter-Based Routing
**Before (Legacy Pattern):**
```typescript
// Single command with mode parameters
if (params.update || params.u) {
    // Update logic
} else if (params.write || params.w) {
    // Write logic  
} else if (params.clone || params.c) {
    // Clone logic
}
```

**After (Commander.js Subcommands):**
```typescript
const repos = new Command('repos');

repos
    .command('update')
    .alias('u')
    .description('Update all parent repositories')
    .action(async (options) => {
        // Update logic
    });

repos
    .command('write')
    .alias('w') 
    .description('Write states to parent-repos.json')
    .action(async (options) => {
        // Write logic
    });
```

### Standard Subcommand Patterns

#### Basic Subcommand Structure
```typescript
const mainCommand = new Command('commandname');

mainCommand
    .description('Main command description')
    .option('--global-flag', 'Global option for all subcommands');

// Subcommand with options
mainCommand
    .command('subcommand')
    .alias('sub')
    .description('Subcommand description')
    .option('--specific-option', 'Option specific to this subcommand')
    .action(async (options, command) => {
        const globalOptions = command.parent?.opts() || {};
        // Access both global and specific options
    });
```

#### Subcommands with Arguments
```typescript
repos
    .command('branch <name>')
    .alias('b')
    .description('Create branch with specified name')
    .option('--push', 'Push branch after creation')
    .action(async (name, options) => {
        // name is the required argument
        // options contains the flags
    });
```

#### Subcommands with Optional Arguments  
```typescript
releaseNotes
    .command('generate [version]')
    .description('Generate release notes for version')
    .option('--from <commit>', 'Start commit')
    .option('--to <commit>', 'End commit', 'HEAD')
    .action(async (version, options) => {
        // version is optional argument
    });
```

### Shared Option Inheritance

#### Parent Command Options
```typescript
// Parent command defines shared options
const repos = new Command('repos')
    .option('--force', 'Force operation')
    .option('--sequential', 'Run sequentially')
    .option('--concurrency <number>', 'Concurrency limit', '15');

// Subcommands inherit parent options automatically
repos
    .command('update')
    .option('--nofetch', 'Skip fetching')
    .action(async (options, command) => {
        const parentOpts = command.parent?.opts() || {};
        // parentOpts contains: force, sequential, concurrency
        // options contains: nofetch
    });
```

#### Access Pattern for Inherited Options
```typescript
.action(async (options, command) => {
    // Get parent (shared) options
    const parentOptions = command.parent?.opts() || {};
    
    // Combine with subcommand-specific options
    const allOptions = { ...parentOptions, ...options };
    
    // Use in business logic
    if (allOptions.force) {
        // Handle force flag
    }
})
```

### Complex Command Hierarchies

#### Multi-Level Commands
```typescript
const releaseNotes = new Command('release-notes');

// First level subcommands
const generate = new Command('generate')
    .description('Generate release notes');

const check = new Command('check')
    .description('Check release note messages');

// Second level subcommands under 'generate'
generate
    .command('current')
    .description('Generate for current release')
    .action(async (options) => {
        // Generate current release notes
    });

generate
    .command('range <from> <to>')
    .description('Generate for commit range')
    .action(async (from, to, options) => {
        // Generate for specific range
    });

// Add to parent
releaseNotes.addCommand(generate);
releaseNotes.addCommand(check);
```

### Command Registration Pattern

#### Export Function Pattern
```typescript
export function createReposCommand(): Command {
    const repos = new Command('repos');
    
    repos.description('Repository operations');
    
    // Add all subcommands
    repos.addCommand(createUpdateCommand());
    repos.addCommand(createWriteCommand());
    repos.addCommand(createCloneCommand());
    
    return repos;
}

function createUpdateCommand(): Command {
    return new Command('update')
        .alias('u')
        .description('Update repositories')
        .option('--nofetch', 'Skip fetch')
        .action(async (options, command) => {
            // Implementation
        });
}
```

## Key Requirements

1. **Replace Parameter Routing**: No more `if (params.command)` logic
2. **Use Descriptive Names**: Clear subcommand and alias names  
3. **Proper Nesting**: Logical command hierarchies
4. **Shared Options**: Common flags at parent level
5. **Individual Logic**: Each subcommand has focused responsibility
6. **Consistent Aliases**: Short forms for frequently used commands
7. **Clear Descriptions**: Help text for each subcommand

## Migration Strategy

1. **Identify Command Modes**: Find parameter-based routing patterns
2. **Create Parent Command**: Define shared options and description
3. **Extract Subcommands**: Convert each mode to separate subcommand
4. **Add Aliases**: Provide short forms for usability
5. **Handle Arguments**: Convert required parameters to command arguments
6. **Test Access Patterns**: Ensure parent options are accessible

## What NOT to do

- Don't use parameter-based command routing (`if (params.mode)`)
- Don't duplicate shared options in every subcommand
- Don't access legacy `ICommandParameters` interface
- Don't create overly deep command hierarchies without clear purpose
- Don't forget to provide aliases for commonly used subcommands

Focus on creating intuitive, discoverable command structures that follow CLI best practices and leverage Commander.js subcommand features.