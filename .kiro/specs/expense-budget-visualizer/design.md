# Design Document

## Overview

The Expense & Budget Visualizer is a mobile-friendly, single-page web application built with HTML, CSS, and vanilla JavaScript. It helps users track daily spending by displaying a total balance, a scrollable history of transactions, and a pie chart of spending distribution by category. All data is stored client-side through the Local Storage API, requiring no backend server.

The application runs with no build step and no frontend frameworks. It is compatible with modern browsers (Chrome, Firefox, Edge, Safari) and can be used as a standalone web page or a browser extension.

## Architecture

The application is a single-page client-side web app with no backend server and no build step. All state lives in the browser and persists through the Local Storage API. The architecture follows an event-driven model: user actions mutate in-memory state, state changes trigger a re-render of the affected UI sections, and every mutation is persisted to Local Storage.

The application is structured into logical modules within a single JavaScript file. Each module owns a distinct responsibility (state, storage, validation, rendering, charting, sorting, theme). Modules expose functions consumed by a central controller that wires DOM events to state mutations and re-renders.

```
User Action → Event Handler → State Mutation → Persist → Re-render
```

### File Structure

The project follows the folder rules: one CSS file in `css/` and one JavaScript file in `js/`.

```
expense-budget-visualizer/
├── index.html
├── css/
│   └── style.css
└── js/
    └── app.js
```

`index.html` loads `style.css` and `app.js`. No additional local JavaScript or CSS files are introduced.

## Components and Interfaces

All modules live inside `js/app.js`. Modules are plain objects or function groups; there is no module bundler.

### State Module

Holds the in-memory `transactions`, `categories`, and `theme`. Provides accessors to read and mutate state. State mutations are the single entry point for changes; every mutation triggers persistence and re-render.

### Storage Module

- `loadState()`: reads `ev_transactions`, `ev_categories`, and `ev_theme` from Local Storage, parses JSON, and returns state (with defaults on failure).
- `saveTransactions()`: serializes the transactions array to `ev_transactions`.
- `saveCategories()`: serializes the categories array to `ev_categories`.
- `saveTheme()`: writes the theme string to `ev_theme`.

Serialization uses `JSON.stringify`. Deserialization uses `JSON.parse` wrapped in error handling that falls back to defaults on malformed data.

### Validation Module

- `validateTransaction(name, amount, category)`: returns a validation result. Rejects when name is empty, amount is empty or not a positive number, or category is not selected.
- `validateCategory(name, existingCategories)`: returns a validation result. Rejects when name is empty or duplicates an existing category (case-insensitive comparison).

Validation functions are pure: they take inputs and return a result without side effects.

### Render Module

- `renderBalance()`: computes the sum of transaction amounts and updates the Balance display.
- `renderList()`: rebuilds the Transaction_List from the transactions array, creating one list item per transaction showing name, amount, and category, each with a delete control.
- `renderCategories()`: rebuilds the category select options from the categories array.

Rendering is idempotent: calling a render function with the same state produces the same output. Each render function reads current state and replaces the relevant DOM region.

### Chart Module

- `aggregateByCategory(transactions)`: returns a map of category to the sum of amounts for transactions in that category. Pure function.
- `renderChart()`: calls `aggregateByCategory`, then draws the Pie_Chart into the chart container.

### Sort Module

- `sortTransactions(transactions, option)`: returns a new sorted array. `option` is `"amount"` (ascending by amount) or `"category"` (alphabetical by category). The function does not mutate the input array. Pure function.

### Theme Module

- `applyTheme(theme)`: sets a `data-theme` attribute on the root `<html>` element and persists the theme.
- `toggleTheme()`: switches between `"dark"` and `"light"`.

CSS defines variables for both themes. The `data-theme` attribute on `<html>` switches the variable values, so the entire interface restyles without JavaScript touching individual element styles.

### Controller / Event Wiring

The controller initializes on `DOMContentLoaded`:

1. Loads state from Local Storage via `loadState()`.
2. Applies the stored theme.
3. Renders the balance, list, categories, and chart.
4. Attaches event listeners:
   - Form submit → validate, add transaction, persist, re-render
   - Custom category add → validate, add category, persist, re-render categories
   - Transaction delete → remove transaction, persist, re-render
   - Sort change → sort transactions, re-render list
   - Theme toggle → toggle theme, persist, apply

### HTML Structure

`index.html` defines the following top-level regions:

- **Header**: contains the Balance display and the theme toggle control
- **Form Section**: contains the input form with fields for name, amount, category (select), and a custom-category input with an add button
- **Sort Controls**: contains the sort option selector (by amount, by category)
- **Transaction List Section**: contains the scrollable Transaction_List container
- **Chart Section**: contains a container element for the Pie_Chart

All interactive elements use semantic HTML (`form`, `button`, `select`, `input`, `ul`/`li`) to support accessibility. The HTML is static markup; dynamic content (list items, chart, balance value) is injected by `app.js` at runtime.

## Data Models

### Transaction

A Transaction is represented as a plain object:

| Field       | Type     | Description                                          |
|-------------|----------|------------------------------------------------------|
| id          | string   | Unique identifier (generated on creation)             |
| name        | string   | The spending item name                               |
| amount      | number   | The spending amount, a positive number               |
| category    | string   | The category label (default or custom)               |
| createdAt   | number   | Creation timestamp in milliseconds since epoch        |

### Application State

The in-memory state holds:

- `transactions`: an array of Transaction objects
- `categories`: an array of category-name strings, initialized with `["Food", "Transport", "Fun"]`
- `theme`: a string, either `"dark"` or `"light"`, defaulting to `"light"`

### Local Storage Schema

State is persisted under the following keys:

| Key                | Stored Value                                   |
|--------------------|-------------------------------------------------|
| `ev_transactions`  | JSON string of the transactions array          |
| `ev_categories`    | JSON string of the categories array             |
| `ev_theme`         | `"dark"` or `"light"`                           |

On page load, the application reads these keys. Missing or malformed entries fall back to defaults (empty transactions, default categories, light theme).

## Chart Implementation

The Pie_Chart is rendered using vanilla JavaScript with inline SVG. This approach is chosen over an external charting library for two reasons:

1. **Self-containment**: The application must work as a browser extension, where Content Security Policy may block externally loaded scripts from a CDN. An inline SVG chart has no external dependency.
2. **Simplicity**: A pie chart requires only basic SVG path arcs, keeping the single `app.js` file self-contained.

The chart module computes each slice's angle from the category total relative to the grand total, then draws SVG `<path>` arcs. Category colors are assigned from a fixed palette. The chart container is an SVG element that is cleared and redrawn on each update.

If the standalone web app context ever removes the extension constraint, Chart.js loaded via CDN in `index.html` remains a valid drop-in alternative without violating the single-file rule for `js/`.

## Theme Implementation

CSS uses custom properties (variables) for colors, backgrounds, and text. `style.css` defines two rule sets:

```css
:root, [data-theme="light"] { /* light palette via custom properties */ }
[data-theme="dark"]           { /* dark palette via custom properties */ }
```

The theme module sets `document.documentElement.setAttribute("data-theme", theme)`. All components reference CSS variables, so theme switching is a single attribute change. This avoids per-element style manipulation in JavaScript.

## Responsive Design

The layout uses CSS Flexbox for vertical stacking of the header, form, sort controls, list, and chart. Key responsive techniques:

- A single-column layout that fills the viewport width on mobile.
- The Transaction_List uses `overflow-y: auto` with a max height to scroll internally without page-level scrolling.
- The chart container scales to the available width using a relative SVG `viewBox`.
- Media queries adjust font sizes, padding, and the chart max width at breakpoints (e.g., `max-width: 480px`).

At viewport widths of 480 pixels or less, all controls and content fit within the width with no horizontal scrolling.

## Error Handling

- **Malformed Local Storage data**: `JSON.parse` failures during `loadState()` are caught and fall back to default state (empty transactions, default categories, light theme). The application never crashes on corrupted storage.
- **Invalid transaction submission**: The validation module rejects submissions with empty fields or non-positive amounts. The controller displays a validation message near the form and does not mutate state.
- **Invalid custom category**: The validation module rejects empty or duplicate category names. The controller displays a validation message and does not add the category.
- **Empty chart state**: When there are no transactions, the chart module renders an empty or placeholder state rather than an empty SVG, avoiding division-by-zero when computing slice angles.

## Testing Strategy

Per NFR-1, no test framework setup is required for this project. The correctness properties below document expected behavior for the pure-logic modules (balance calculation, category aggregation, sorting, validation, and Local Storage round-trip). These can be verified through manual testing of representative cases, or optionally through a lightweight property-based test harness if one is added later.

UI behaviors (form display, chart rendering, theme toggle, responsive layout) are verified through smoke testing with 1-2 representative examples, since they do not vary meaningfully with input data.

## Correctness Properties

The following properties capture expected behavior for the pure-logic modules. These are the highest-value targets for verification because they vary meaningfully with input, test our own code, and run cheaply in memory.

### Property 1: Balance equals sum of transaction amounts

**Validates: Requirements 5.2, 5.3**

For any set of transactions, the computed Balance equals the sum of all transaction `amount` values.

```
∀ transactions: balance(transactions) == sum(t.amount for t in transactions)
```

### Property 2: Chart segment sum equals total spending

**Validates: Requirements 6.3**

For any set of transactions, the sum of all category-aggregated values equals the sum of all transaction amounts.

```
∀ transactions: sum(aggregateByCategory(transactions).values()) == sum(t.amount for t in transactions)
```

### Property 3: Chart segment correctness

**Validates: Requirements 6.2**

For any set of transactions, each category-aggregated value equals the sum of amounts of transactions in that category.

```
∀ transactions, ∀ category c:
  aggregateByCategory(transactions)[c] == sum(t.amount for t in transactions where t.category == c)
```

### Property 4: Sorting preserves all entries

**Validates: Requirements 8.3**

For any set of transactions and any sort option, the sorted list contains the same transactions as the input. The sorted length equals the input length and every input transaction appears in the output.

```
∀ transactions, ∀ option:
  sortTransactions(transactions, option) is a permutation of transactions
```

### Property 5: Sorting idempotence

**Validates: Requirements 8.4**

For any set of transactions and any sort option, sorting an already sorted list with the same option produces the same order.

```
∀ transactions, ∀ option:
  sortTransactions(sortTransactions(transactions, option), option) == sortTransactions(transactions, option)
```

### Property 6: Validation rejects invalid transactions

**Validates: Requirements 2.1, 2.2**

For any transaction submission with an empty name, a non-positive amount, or no category, validation rejects the submission and the transaction list size does not increase.

```
∀ (name, amount, category) where name empty OR amount <= 0 OR category empty:
  validateTransaction(name, amount, category) is rejected
```

### Property 7: Custom category validation rejects empty and duplicate names

**Validates: Requirements 7.4**

For any category name that is empty or case-insensitively duplicates an existing category, validation rejects the category and the categories array does not change.

```
∀ name where name empty OR name exists in existingCategories (case-insensitive):
  validateCategory(name, existingCategories) is rejected
```

### Property 8: Local Storage round-trip equivalence

**Validates: Requirements 10.3**

For any set of transactions, serializing the transactions to Local Storage and loading them back produces an equivalent set of transactions (same length, same field values per transaction).

```
∀ transactions:
  loadTransactions(saveTransactions(transactions)) == transactions
```

### Property 9: Deletion decreases list size by exactly one

**Validates: Requirements 4.2**

For any non-empty transaction list and any transaction in the list, deleting that transaction produces a list with length equal to the original length minus one, and the deleted transaction is absent from the result.

```
∀ transactions where len > 0, ∀ t in transactions:
  len(deleteTransaction(transactions, t.id)) == len(transactions) - 1
  AND t not in deleteTransaction(transactions, t.id)
```

### Property 10: Deletion correctness for balance and chart

**Validates: Requirements 4.2, 5.3, 6.4**

For any set of transactions and any transaction deleted, the recomputed balance equals the balance computed over the remaining transactions, and the chart aggregation reflects the removal of the deleted transaction.

```
∀ transactions, ∀ t in transactions:
  balance(deleteTransaction(transactions, t.id)) == balance(transactions) - t.amount
  AND aggregateByCategory(deleteTransaction(transactions, t.id)) reflects the removal of t
```

## Out of Scope

The following items from the project overview are explicitly not part of this spec:

- Monthly summary view (skipped optional challenge)
- Spending limit highlighting (skipped optional challenge)
- Backend server or database (all data is client-side)
- User authentication or multi-user support
- Build tooling, bundlers, or package managers
- Test framework setup (per NFR-1, no test setup required)
