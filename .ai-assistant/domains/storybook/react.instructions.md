---
applyTo: "**/*.stories.ts,**/*.stories.tsx,**/*.stories.js,**/*.stories.jsx"
priority: high
role: [developer, tester]
---

# Storybook Guidelines

> **Applies to:** All Storybook story files (`*.stories.ts`, `*.stories.tsx`)
> **Related:** [testing.instructions.md](../testing/vitest.instructions.md) | [documentation.instructions.md](../_universal/documentation.instructions.md)

## Overview

Storybook is used for:
- Component development in isolation
- Visual documentation of component states
- Interaction testing via play functions
- Accessibility auditing
- Visual regression testing

## Story File Structure

### Meta Configuration

```typescript
import type { Meta, StoryObj } from '@storybook/react'; // or '@storybook/vue3'
import { MyComponent } from './MyComponent';

/**
 * Test Plan: MyComponent
 *
 * Scenario: Default rendering
 *   Given the component is mounted with default props
 *   Then it should display correctly
 *
 * Scenario: User interaction
 *   Given the component is mounted
 *   When the user clicks the button
 *   Then the state should update
 */

const meta: Meta<typeof MyComponent> = {
  title: 'Category/Subcategory/MyComponent',
  component: MyComponent,
  parameters: {
    layout: 'centered', // or 'fullscreen', 'padded'
  },
  tags: ['autodocs'],
  argTypes: {
    variant: {
      control: 'select',
      options: ['primary', 'secondary', 'danger'],
    },
  },
};

export default meta;
type Story = StoryObj<typeof meta>;
```

### Story Title Organization

Stories should follow a consistent hierarchy:

```typescript
// Pattern: 'Category/Subcategory/ComponentName'

// Components
title: 'Components/Forms/TextInput'
title: 'Components/Navigation/Sidebar'
title: 'Components/Feedback/Toast'

// Views/Pages
title: 'Views/Dashboard/Overview'
title: 'Views/Settings/Profile'

// Primitives
title: 'Primitives/Controls/Button'
title: 'Primitives/Layout/Stack'
```

### Basic Stories

```typescript
// Default state
export const Default: Story = {
  args: {
    label: 'Click me',
    variant: 'primary',
  },
};

// Variant states
export const Secondary: Story = {
  args: {
    ...Default.args,
    variant: 'secondary',
  },
};

export const Disabled: Story = {
  args: {
    ...Default.args,
    disabled: true,
  },
};

// With custom render
export const WithIcon: Story = {
  args: {
    label: 'Save',
    icon: 'save',
  },
  render: (args) => (
    <div style={{ padding: '20px' }}>
      <MyComponent {...args} />
    </div>
  ),
};
```

## Interaction Tests with play()

### Basic Structure

```typescript
import { expect, userEvent, within, waitFor } from '@storybook/test';

export const Interactive: Story = {
  args: {
    label: 'Submit',
  },
  play: async ({ canvasElement, step }) => {
    const canvas = within(canvasElement);

    await step('Click the button', async () => {
      const button = canvas.getByRole('button', { name: 'Submit' });
      await userEvent.click(button);
    });

    await step('Verify state change', async () => {
      await waitFor(() => {
        expect(canvas.getByText('Submitted')).toBeInTheDocument();
      });
    });
  },
};
```

### Query Strategies

**Component-scoped queries:**
```typescript
const canvas = within(canvasElement);
const button = canvas.getByRole('button', { name: 'Submit' });
const input = canvas.getByRole('textbox', { name: 'Email' });
```

**Global queries (for modals, toasts, dropdowns):**
```typescript
import { screen } from '@storybook/test';

const modal = screen.getByRole('dialog');
const toast = screen.getByRole('status');
const dropdown = screen.getByRole('listbox');
```

### Common Interactions

**Button click:**
```typescript
await step('Click submit button', async () => {
  const button = canvas.getByRole('button', { name: 'Submit' });
  await userEvent.click(button);
});
```

**Text input:**
```typescript
await step('Enter email', async () => {
  const input = canvas.getByRole('textbox', { name: 'Email' });
  await userEvent.clear(input);
  await userEvent.type(input, 'test@example.com');
});
```

**Number input:**
```typescript
await step('Enter quantity', async () => {
  const input = canvas.getByRole('spinbutton', { name: 'Quantity' });
  await userEvent.clear(input);
  await userEvent.type(input, '5');
});
```

**Checkbox/Toggle:**
```typescript
await step('Toggle checkbox', async () => {
  const checkbox = canvas.getByRole('checkbox', { name: 'Accept terms' });
  await userEvent.click(checkbox);
  expect(checkbox).toBeChecked();
});
```

**Select/Dropdown:**
```typescript
await step('Select option', async () => {
  const select = canvas.getByRole('combobox', { name: 'Country' });
  await userEvent.click(select);

  const option = screen.getByRole('option', { name: 'United States' });
  await userEvent.click(option);
});
```

**Keyboard interaction:**
```typescript
await step('Submit with Enter key', async () => {
  const input = canvas.getByRole('textbox');
  await userEvent.type(input, 'test{Enter}');
});
```

## Testing Library Query Priority

Use queries in this priority order:

1. **`getByRole`** - Accessible to everyone (preferred)
2. **`getByLabelText`** - Form elements
3. **`getByPlaceholderText`** - Fallback for inputs
4. **`getByText`** - Non-interactive elements
5. **`getByTestId`** - Last resort

```typescript
// Preferred - uses accessibility roles
canvas.getByRole('button', { name: 'Submit' });
canvas.getByRole('textbox', { name: 'Email' });
canvas.getByRole('heading', { level: 1 });

// Fallback - data-testid
canvas.getByTestId('submit-button');
```

## Async Handling

**Always use waitFor for async assertions:**

```typescript
// Correct
await waitFor(() => {
  expect(canvas.getByText('Success')).toBeInTheDocument();
});

// Incorrect - race condition
expect(canvas.getByText('Success')).toBeInTheDocument();
```

**Check for element removal:**
```typescript
await waitFor(() => {
  expect(canvas.queryByRole('alert')).not.toBeInTheDocument();
});
```

## Mocking

### MSW for API Mocking

```typescript
import { http, HttpResponse } from 'msw';

export const WithData: Story = {
  parameters: {
    msw: {
      handlers: [
        http.get('/api/users', () => {
          return HttpResponse.json([
            { id: 1, name: 'John' },
            { id: 2, name: 'Jane' },
          ]);
        }),
      ],
    },
  },
};

export const WithError: Story = {
  parameters: {
    msw: {
      handlers: [
        http.get('/api/users', () => {
          return HttpResponse.json(
            { error: 'Server error' },
            { status: 500 }
          );
        }),
      ],
    },
  },
};
```

### Store/State Mocking

```typescript
// If using decorators for state providers
export const WithAuthenticatedUser: Story = {
  decorators: [
    (Story) => (
      <AuthProvider initialUser={{ id: 1, name: 'John' }}>
        <Story />
      </AuthProvider>
    ),
  ],
};
```

## Story Parameters

### Layout

```typescript
parameters: {
  layout: 'centered',    // Center in viewport
  layout: 'fullscreen',  // Fill viewport
  layout: 'padded',      // Add padding (default)
}
```

### Backgrounds

```typescript
parameters: {
  backgrounds: {
    default: 'dark',
    values: [
      { name: 'light', value: '#ffffff' },
      { name: 'dark', value: '#1a1a1a' },
    ],
  },
}
```

### Viewport

```typescript
parameters: {
  viewport: {
    defaultViewport: 'mobile1',
  },
}
```

### Disable Controls

```typescript
parameters: {
  controls: { disable: true },
}
```

## Best Practices

### Story Naming

```typescript
// Good - descriptive states
export const Default: Story = { ... };
export const Disabled: Story = { ... };
export const WithError: Story = { ... };
export const Loading: Story = { ... };

// Bad - vague or numbered
export const Story1: Story = { ... };
export const Test: Story = { ... };
```

### Story Organization

```typescript
// Visual states first
export const Default: Story = { ... };
export const Hover: Story = { ... };
export const Disabled: Story = { ... };
export const WithError: Story = { ... };

// Interactive tests last
export const UserFlow: Story = {
  play: async ({ canvasElement, step }) => { ... },
};
```

### Test Plan Alignment

Every story with a `play()` function should have a corresponding test plan:

```typescript
/**
 * Test Plan: LoginForm
 *
 * Scenario: Successful login
 *   Given valid credentials
 *   When user submits the form
 *   Then success message appears
 *
 * Scenario: Invalid credentials
 *   Given invalid credentials
 *   When user submits the form
 *   Then error message appears
 */

export const SuccessfulLogin: Story = {
  play: async ({ canvasElement, step }) => {
    // Tests scenario 1
  },
};

export const InvalidCredentials: Story = {
  play: async ({ canvasElement, step }) => {
    // Tests scenario 2
  },
};
```

## Common Pitfalls

### Missing waitFor

```typescript
// Flaky
const button = canvas.getByRole('button');
await userEvent.click(button);
expect(screen.getByText('Success')).toBeInTheDocument();

// Reliable
const button = canvas.getByRole('button');
await userEvent.click(button);
await waitFor(() => {
  expect(screen.getByText('Success')).toBeInTheDocument();
});
```

### Wrong Query Scope

```typescript
// Wrong - selects from entire page
const checkboxes = screen.getAllByRole('checkbox');

// Correct - scoped to component
const table = canvas.getByRole('table');
const checkboxes = within(table).getAllByRole('checkbox');
```

### Toast vs Alert Roles

```typescript
// Success notifications use status role
const toast = screen.getByRole('status');

// Errors use alert role
const error = screen.getByRole('alert');
```

### Global Queries in Component Scope

```typescript
// Wrong - modals are teleported outside component
const modal = canvas.getByRole('dialog');

// Correct - use screen for teleported elements
const modal = screen.getByRole('dialog');
```

## Running Storybook Tests

```bash
# Start Storybook
npm run storybook

# Run all story tests
npm run test-storybook

# Run specific component tests
npm run test-storybook -- --grep "ComponentName"

# With coverage
npm run test-storybook -- --coverage
```

---

**See Also:**
- [Testing Guidelines](../testing/vitest.instructions.md)
- [Documentation Guidelines](../_universal/documentation.instructions.md)
