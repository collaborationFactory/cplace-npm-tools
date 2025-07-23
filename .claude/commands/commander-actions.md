# /commander-actions - Refactor Action Handlers for Commander.js

You are refactoring action handlers to use proper Commander.js patterns instead of legacy parameter interfaces. Focus on converting `ICommandParameters` usage to type-safe Commander.js option handling with modern TypeScript patterns.

## Your Task

Replace legacy action handler for $ARGUMENTS  patterns with modern Commander.js action handlers that use proper TypeScript typing and eliminate manual parameter conversion.

### Convert Legacy Action Handlers
**Before (Legacy Pattern):**
```typescript
interface ICommandParameters {
    [param: string]: unknown;
}

class UpdateCommand implements ICommand {
    async execute(params: ICommandParameters): Promise<void> {
        const force = !!params.force;
        const concurrency = parseInt(params.concurrency as string) || 15;
        const sequential = !!params.sequential;
        
        // Business logic
    }
}
```

**After (Commander.js Pattern):**
```typescript
interface UpdateOptions {
    force?: boolean;
    concurrency: number;
    sequential?: boolean;
    nofetch?: boolean;
}

interface GlobalOptions {
    verbose?: boolean;
    force?: boolean;
    sequential?: boolean;
    concurrency: number;
}

repos
    .command('update')
    .option('--nofetch', 'Skip fetching repositories')
    .option('--reset-to-remote', 'Hard reset to remote state')
    .action(async (options: UpdateOptions, command: Command) => {
        const globalOptions = command.parent?.opts<GlobalOptions>() || {};
        
        // Combine options with proper typing
        const config = {
            force: globalOptions.force || false,
            concurrency: globalOptions.concurrency,
            sequential: globalOptions.sequential || false,
            nofetch: options.nofetch || false,
            resetToRemote: options.resetToRemote || false
        };
        
        // Business logic with type-safe config
        await updateRepositories(config);
    });
```

### Standard Action Handler Patterns

#### Basic Action Handler
```typescript
interface BasicOptions {
    output?: string;
    format: string;
    verbose?: boolean;
}

.action(async (options: BasicOptions) => {
    // Direct access to typed options
    if (options.verbose) {
        console.log('Verbose mode enabled');
    }
    
    await performAction({
        outputPath: options.output,
        format: options.format
    });
});
```

#### Action Handler with Arguments
```typescript
interface BranchOptions {
    push?: boolean;
    parent?: string;
    from?: string;
}

.command('branch <name>')
.action(async (name: string, options: BranchOptions) => {
    // name is the required argument
    // options are the command flags
    
    const config = {
        branchName: name,
        shouldPush: options.push || false,
        parentRepo: options.parent || 'main',
        baseBranch: options.from || 'develop'
    };
    
    await createBranch(config);
});
```

#### Action Handler with Parent Options
```typescript
interface SubcommandOptions {
    specificFlag?: boolean;
}

interface ParentOptions {
    force?: boolean;
    verbose?: boolean;
    concurrency: number;
}

.action(async (options: SubcommandOptions, command: Command) => {
    // Get parent command options
    const parentOptions = command.parent?.opts<ParentOptions>() || {};
    
    // Combine with proper precedence
    const config = {
        force: parentOptions.force || false,
        verbose: parentOptions.verbose || false,
        concurrency: parentOptions.concurrency,
        specificBehavior: options.specificFlag || false
    };
    
    await executeWithConfig(config);
});
```

### Error Handling Patterns

#### Proper Error Handling
```typescript
.action(async (options: CommandOptions) => {
    try {
        await businessLogic(options);
    } catch (error) {
        if (options.verbose) {
            console.error('Stack trace:', error);
        } else {
            console.error('Error:', error.message);
        }
        process.exit(1);
    }
});
```

#### Validation in Action Handler
```typescript
.action(async (options: CommandOptions, command: Command) => {
    // Pre-action validation (if not handled by Commander)
    const parentOpts = command.parent?.opts() || {};
    
    if (options.conflictingFlag && parentOpts.anotherFlag) {
        console.error('Cannot use --conflicting-flag with --another-flag');
        process.exit(1);
    }
    
    // Continue with business logic
    await execute(options);
});
```

### Type-Safe Configuration Building

#### Configuration Builder Pattern
```typescript
interface ReposConfig {
    force: boolean;
    sequential: boolean;
    concurrency: number;
    nofetch: boolean;
    resetToRemote: boolean;
    depth?: number;
}

function buildReposConfig(
    globalOptions: GlobalOptions, 
    localOptions: LocalOptions
): ReposConfig {
    return {
        force: globalOptions.force || false,
        sequential: globalOptions.sequential || false,
        concurrency: globalOptions.concurrency,
        nofetch: localOptions.nofetch || false,
        resetToRemote: localOptions.resetToRemote || false,
        depth: localOptions.depth
    };
}

.action(async (options: LocalOptions, command: Command) => {
    const globalOptions = command.parent?.opts<GlobalOptions>() || {};
    const config = buildReposConfig(globalOptions, options);
    
    await updateRepos(config);
});
```

#### Option Merging with Defaults
```typescript
interface CommandConfig {
    concurrency: number;
    timeout: number;
    retries: number;
    verbose: boolean;
}

const DEFAULT_CONFIG: CommandConfig = {
    concurrency: 15,
    timeout: 30000,
    retries: 3,
    verbose: false
};

.action(async (options: Partial<CommandConfig>, command: Command) => {
    const parentOptions = command.parent?.opts<Partial<CommandConfig>>() || {};
    
    // Merge with proper precedence: CLI options > parent options > defaults
    const config: CommandConfig = {
        ...DEFAULT_CONFIG,
        ...parentOptions,
        ...options
    };
    
    await executeWithConfig(config);
});
```

### Business Logic Integration

#### Clean Separation of Concerns
```typescript
// Business logic function with clear interface
async function updateRepositories(config: {
    force: boolean;
    concurrency: number;
    nofetch: boolean;
    resetToRemote: boolean;
}): Promise<void> {
    // Implementation
}

// Action handler - only parameter processing
.action(async (options: UpdateOptions, command: Command) => {
    const globalOptions = command.parent?.opts<GlobalOptions>() || {};
    
    const config = {
        force: globalOptions.force || false,
        concurrency: globalOptions.concurrency,
        nofetch: options.nofetch || false,
        resetToRemote: options.resetToRemote || false
    };
    
    // Delegate to business logic
    await updateRepositories(config);
});
```

#### Progress and Logging Integration
```typescript
.action(async (options: CommandOptions, command: Command) => {
    const globalOptions = command.parent?.opts<GlobalOptions>() || {};
    
    // Setup logging based on global verbose flag
    const logger = createLogger({
        level: globalOptions.verbose ? 'debug' : 'info'
    });
    
    const config = {
        ...options,
        logger,
        verbose: globalOptions.verbose || false
    };
    
    await executeCommand(config);
});
```

### Common Patterns

#### Option Transformation
```typescript
interface CliOptions {
    outputDir?: string;
    formatType: string;
    includeMetadata?: boolean;
}

interface BusinessConfig {
    outputDirectory: string;
    format: OutputFormat;
    metadata: boolean;
}

.action(async (options: CliOptions) => {
    // Transform CLI options to business config
    const config: BusinessConfig = {
        outputDirectory: options.outputDir || './output',
        format: parseOutputFormat(options.formatType),
        metadata: options.includeMetadata || false
    };
    
    await generateOutput(config);
});
```

#### Async Error Handling with Cleanup
```typescript
.action(async (options: CommandOptions) => {
    let resource: Resource | null = null;
    
    try {
        resource = await acquireResource(options);
        await performOperation(resource, options);
    } catch (error) {
        console.error('Operation failed:', error.message);
        process.exit(1);
    } finally {
        if (resource) {
            await resource.cleanup();
        }
    }
});
```

## Key Requirements

1. **Remove ICommandParameters**: Use proper TypeScript interfaces
2. **Type-Safe Options**: Define interfaces for all option types
3. **Parent Option Access**: Properly access inherited options
4. **Error Handling**: Consistent error handling patterns
5. **Clean Separation**: Keep business logic separate from CLI handling
6. **Option Processing**: Transform CLI options to business config
7. **No Manual Parsing**: Let Commander handle all parameter parsing

## Migration Strategy

1. **Define Option Interfaces**: Create TypeScript interfaces for all option types
2. **Replace ICommandParameters**: Remove legacy parameter interface usage
3. **Update Action Signatures**: Use proper Commander.js action handler signatures
4. **Extract Business Logic**: Separate CLI handling from business logic
5. **Add Error Handling**: Implement consistent error handling
6. **Remove Parameter Conversion**: Eliminate manual parameter processing

## What NOT to do

- Don't use `ICommandParameters` interface
- Don't manually parse or convert parameters in action handlers
- Don't access `params[key]` properties
- Don't mix CLI parameter handling with business logic
- Don't ignore error handling in async actions
- Don't forget to handle parent command options
- Don't use `any` types for options

Focus on clean, type-safe action handlers that properly integrate with Commander.js while maintaining clear separation between CLI handling and business logic.
