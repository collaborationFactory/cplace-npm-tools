# /commander-options - Standardize Commander.js Option Definitions

You are refactoring parameter parsing to use Commander.js framework best practices. Focus on converting legacy parameter access patterns to proper Commander.js option definitions with built-in validation.

## Your Task

Refactor the provided code to use Commander.js `.option()` declarations instead of manual parameter parsing. Follow these patterns:

### Convert Legacy Parameter Access
**Before (Legacy):**
```typescript
const force = !!params.force;
const concurrency = parseInt(params.concurrency as string) || 15;
const depth = params.depth ? parseInt(params.depth as string) : undefined;
```

**After (Commander.js):**
```typescript
.option('--force', 'Force operation even if working copy is not clean')
.option('--concurrency <number>', 'Limit parallel execution concurrency', '15')
.option('--depth <number>', 'Create shallow clone with specified depth', parseInt)
```

### Standard Option Patterns

#### Boolean Flags
```typescript
.option('--force', 'Force operation despite unclean working copy')
.option('--verbose', 'Enable verbose output')
.option('--sequential', 'Run operations sequentially instead of in parallel')
```

#### String Parameters
```typescript
.option('--from <commit>', 'Start commit (required)')
.option('--to <commit>', 'End commit', 'HEAD')
.option('--lang <language>', 'Language for output', 'en')
```

#### Number Parameters with Validation
```typescript
.option('--concurrency <number>', 'Limit parallel execution', '15')
.option('--depth <number>', 'Shallow clone depth', parseInt)
.option('--size <number>', 'Number of commits to check', '100')
```

#### Choice Parameters
```typescript
.option('--format <type>', 'Output format')
.choices(['json', 'xml', 'csv'])
```

### Aliases and Short Forms
```typescript
.option('-v, --verbose', 'Enable verbose output')
.option('-f, --force', 'Force operation')
.option('-c, --concurrency <number>', 'Concurrency limit', '15')
```

### Required Options
```typescript
.requiredOption('--from <commit>', 'Start commit is required')
.requiredOption('--config <file>', 'Configuration file path')
```

## Key Requirements

1. **Remove Manual Type Conversion**: Let Commander.js handle type coercion
2. **Add Descriptive Help Text**: Each option needs clear description
3. **Use Proper Default Values**: Set defaults in Commander, not in business logic
4. **Add Aliases**: Provide short forms for commonly used options
5. **Validate at Option Level**: Use Commander's built-in validation
6. **Follow Naming Conventions**: Use kebab-case for option names
7. **Group Related Options**: Keep similar functionality together

## Common Validation Patterns

### Custom Validators
```typescript
.option('--timeout <ms>', 'Timeout in milliseconds', (value) => {
    const parsed = parseInt(value);
    if (isNaN(parsed) || parsed < 0) {
        throw new Error('Timeout must be a positive number');
    }
    return parsed;
})
```

### Range Validation
```typescript
.option('--concurrency <number>', 'Concurrency (1-50)', (value) => {
    const parsed = parseInt(value);
    if (isNaN(parsed) || parsed < 1 || parsed > 50) {
        throw new Error('Concurrency must be between 1 and 50');
    }
    return parsed;
})
```

## What NOT to do

- Don't use `params[key]` parameter access
- Don't do manual type conversion in action handlers
- Don't validate parameters in business logic
- Don't use the legacy `ICommandParameters` interface
- Don't set defaults in the action handler

Focus on clean, declarative option definitions that leverage Commander.js built-in features for validation and type coercion.