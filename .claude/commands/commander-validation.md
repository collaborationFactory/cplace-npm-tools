# /commander-validation - Implement Commander.js Parameter Validation

You are refactoring parameter validation to use Commander.js built-in validation mechanisms instead of manual validation in business logic. Focus on moving validation to the framework level for better error handling and user experience.

## Your Task

Replace manual parameter validation and type checking with Commander.js declarative validation. Move validation from action handlers to option and argument definitions.

### Convert Manual Validation
**Before (Manual Validation):**
```typescript
.action(async (options) => {
    if (!options.from) {
        throw new Error('--from parameter is required');
    }
    
    const concurrency = parseInt(options.concurrency);
    if (isNaN(concurrency) || concurrency < 1) {
        throw new Error('Concurrency must be a positive number');
    }
    
    if (options.format && !['json', 'xml', 'csv'].includes(options.format)) {
        throw new Error('Format must be json, xml, or csv');
    }
});
```

**After (Commander.js Validation):**
```typescript
.requiredOption('--from <commit>', 'Start commit is required')
.option('--concurrency <number>', 'Concurrency limit', validateConcurrency, 15)
.option('--format <type>', 'Output format')
.choices(['json', 'xml', 'csv'])

function validateConcurrency(value: string): number {
    const parsed = parseInt(value);
    if (isNaN(parsed) || parsed < 1) {
        throw new Error('Concurrency must be a positive number');
    }
    return parsed;
}
```

### Built-in Validation Patterns

#### Required Options
```typescript
.requiredOption('--config <file>', 'Configuration file path')
.requiredOption('--from <commit>', 'Start commit (required)')
.requiredOption('--target <branch>', 'Target branch name')
```

#### Choice Validation
```typescript
.option('--format <type>', 'Output format')
.choices(['json', 'xml', 'csv', 'yaml'])

.option('--log-level <level>', 'Logging level')
.choices(['error', 'warn', 'info', 'debug'])

.option('--branch-type <type>', 'Branch type')
.choices(['feature', 'hotfix', 'release'])
```

#### Custom Argument Parsers
```typescript
.option('--timeout <ms>', 'Timeout in milliseconds', parseTimeout)
.option('--depth <number>', 'Clone depth', parseDepth)
.option('--concurrency <count>', 'Parallel execution limit', parseConcurrency)

function parseTimeout(value: string): number {
    const parsed = parseInt(value);
    if (isNaN(parsed) || parsed < 100) {
        throw new Error('Timeout must be at least 100ms');
    }
    return parsed;
}

function parseDepth(value: string): number {
    const parsed = parseInt(value);
    if (isNaN(parsed) || parsed < 1) {
        throw new Error('Depth must be a positive integer');
    }
    return parsed;
}

function parseConcurrency(value: string): number {
    const parsed = parseInt(value);
    if (isNaN(parsed) || parsed < 1 || parsed > 50) {
        throw new Error('Concurrency must be between 1 and 50');
    }
    return parsed;
}
```

### Advanced Validation Patterns

#### Range Validation
```typescript
function validateRange(min: number, max: number) {
    return (value: string): number => {
        const parsed = parseInt(value);
        if (isNaN(parsed) || parsed < min || parsed > max) {
            throw new Error(`Value must be between ${min} and ${max}`);
        }
        return parsed;
    };
}

.option('--priority <level>', 'Priority level (1-10)', validateRange(1, 10))
.option('--retry <count>', 'Retry attempts (0-5)', validateRange(0, 5))
```

#### Pattern Validation
```typescript
function validateEmail(value: string): string {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(value)) {
        throw new Error('Invalid email format');
    }
    return value;
}

function validateCommitHash(value: string): string {
    const hashRegex = /^[a-f0-9]{7,40}$/i;
    if (!hashRegex.test(value)) {
        throw new Error('Invalid commit hash format');
    }
    return value;
}

.option('--email <address>', 'Email address', validateEmail)
.option('--commit <hash>', 'Commit hash', validateCommitHash)
```

#### File/Path Validation
```typescript
import { existsSync, statSync } from 'fs';

function validateFile(filePath: string): string {
    if (!existsSync(filePath)) {
        throw new Error(`File does not exist: ${filePath}`);
    }
    if (!statSync(filePath).isFile()) {
        throw new Error(`Path is not a file: ${filePath}`);
    }
    return filePath;
}

function validateDirectory(dirPath: string): string {
    if (!existsSync(dirPath)) {
        throw new Error(`Directory does not exist: ${dirPath}`);
    }
    if (!statSync(dirPath).isDirectory()) {
        throw new Error(`Path is not a directory: ${dirPath}`);
    }
    return dirPath;
}

.option('--config <file>', 'Configuration file', validateFile)
.option('--output-dir <path>', 'Output directory', validateDirectory)
```

### Argument Validation

#### Required Arguments
```typescript
.command('branch <name>')
.description('Create branch with specified name')
.action(async (name: string, options) => {
    // name is automatically required by Commander
    // No need to check if name exists
});
```

#### Optional Arguments with Validation
```typescript
.command('generate [version]')
.description('Generate for optional version')
.action(async (version: string | undefined, options) => {
    if (version && !isValidVersion(version)) {
        throw new Error('Invalid version format');
    }
});

function isValidVersion(version: string): boolean {
    return /^\d+\.\d+\.\d+(-\w+)?$/.test(version);
}
```

### Multiple Choice and Complex Validation

#### Mutually Exclusive Options
```typescript
.option('--from-tag <tag>', 'Start from tag')
.option('--from-commit <hash>', 'Start from commit')
.hook('preAction', (thisCommand) => {
    const opts = thisCommand.opts();
    if (opts.fromTag && opts.fromCommit) {
        throw new Error('Cannot specify both --from-tag and --from-commit');
    }
    if (!opts.fromTag && !opts.fromCommit) {
        throw new Error('Must specify either --from-tag or --from-commit');
    }
});
```

#### Conditional Validation
```typescript
.option('--format <type>', 'Output format').choices(['pdf', 'json', 'html'])
.option('--template <file>', 'Template file (required for PDF format)')
.hook('preAction', (thisCommand) => {
    const opts = thisCommand.opts();
    if (opts.format === 'pdf' && !opts.template) {
        throw new Error('--template is required when format is PDF');
    }
});
```

### Common Validation Functions

```typescript
// Reusable validation functions
export const validators = {
    positiveInteger: (value: string): number => {
        const parsed = parseInt(value);
        if (isNaN(parsed) || parsed < 1) {
            throw new Error('Must be a positive integer');
        }
        return parsed;
    },
    
    nonEmptyString: (value: string): string => {
        if (!value.trim()) {
            throw new Error('Value cannot be empty');
        }
        return value.trim();
    },
    
    url: (value: string): string => {
        try {
            new URL(value);
            return value;
        } catch {
            throw new Error('Must be a valid URL');
        }
    },
    
    semverVersion: (value: string): string => {
        if (!/^\d+\.\d+\.\d+(-\w+(\.\d+)?)?$/.test(value)) {
            throw new Error('Must be a valid semantic version (e.g., 1.2.3)');
        }
        return value;
    }
};
```

## Key Requirements

1. **Move Validation Up**: Validate at option/argument definition level
2. **Use Built-in Features**: Leverage `.choices()`, `.requiredOption()`, parsers
3. **Custom Validators**: Create reusable validation functions
4. **Clear Error Messages**: Provide helpful validation error text
5. **Type Safety**: Return properly typed values from validators  
6. **Early Validation**: Fail fast before action execution
7. **Consistent Patterns**: Use similar validation approaches across commands

## Migration Strategy

1. **Identify Manual Validation**: Find validation logic in action handlers
2. **Extract to Validators**: Create dedicated validation functions
3. **Apply at Definition**: Move validation to option declarations
4. **Remove Action Validation**: Clean up manual checks from business logic
5. **Test Error Cases**: Ensure validation errors are user-friendly
6. **Share Common Validators**: Reuse validation functions across commands

## What NOT to do

- Don't validate parameters inside action handlers
- Don't use generic error messages
- Don't ignore Commander's built-in validation features
- Don't duplicate validation logic across commands
- Don't throw raw errors without context
- Don't validate optional parameters without checking existence first

Focus on declarative validation that happens before your business logic runs, providing clear error messages and type-safe parameter access.