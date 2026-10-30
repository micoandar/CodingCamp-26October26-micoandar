# Requirements Document

## Introduction

The Expense & Budget Visualizer is a mobile-friendly web application that helps users track daily spending. The application displays a total balance, a scrollable history of transactions, and a pie chart visualizing spending distribution by category. All data is stored client-side using the browser Local Storage API, requiring no backend server.

The application is built with HTML for structure, CSS for styling, and vanilla JavaScript for logic, without any frontend frameworks. The application is compatible with modern browsers (Chrome, Firefox, Edge, Safari) and can be used as a standalone web page or a browser extension.

## Glossary

- **Expense_Visualizer**: The web application that records spending and visualizes budgets
- **Transaction**: A single spending record containing a name, a positive amount, and a category
- **Category**: A label classifying a transaction; default categories are Food, Transport, and Fun; users may also define custom categories
- **Balance**: The total sum of all transaction amounts
- **Transaction_List**: The scrollable display area showing all recorded transactions
- **Pie_Chart**: A circular chart showing the spending distribution across categories
- **Local_Storage**: The browser Web Storage API used to persist data client-side
- **Theme**: The visual color mode of the interface, either dark or light

## Requirements

### Requirement 1: Transaction Entry

**User Story:** As a user, I want to add a spending transaction with a name, an amount, and a category, so that I can record my daily expenses.

#### Acceptance Criteria

1. THE Expense_Visualizer SHALL provide an input form with a name field accepting up to 100 characters, an amount field accepting numeric values, and a category field for selecting from available categories
2. WHEN a transaction is submitted with a name of up to 100 characters, a positive amount from 0.01 to 999,999.99, and a selected category, THE Expense_Visualizer SHALL add the transaction to the Transaction_List
3. WHEN a transaction is added, THE Expense_Visualizer SHALL store the transaction in Local_Storage
4. WHEN a transaction is successfully added to the Transaction_List, THE Expense_Visualizer SHALL clear the input form fields

### Requirement 2: Transaction Validation

**User Story:** As a user, I want to be prevented from submitting incomplete or invalid transactions, so that my records stay accurate.

#### Acceptance Criteria

1. IF a transaction is submitted with a name that is empty or contains only whitespace, an empty amount, or no category selected, THEN THE Expense_Visualizer SHALL display a validation message indicating each missing field and reject the submission
2. IF a transaction is submitted with a non-positive or non-numeric amount, THEN THE Expense_Visualizer SHALL display a validation message indicating that the amount is invalid and reject the submission

### Requirement 3: Transaction List Display

**User Story:** As a user, I want to see all my recorded transactions in a scrollable list, so that I can review my spending history.

#### Acceptance Criteria

1. THE Expense_Visualizer SHALL display the Transaction_List as a scrollable area containing all recorded transactions ordered with the most recently recorded transaction appearing first
2. THE Expense_Visualizer SHALL display each transaction with its name, amount, and category
3. WHEN the page loads, THE Expense_Visualizer SHALL populate the Transaction_List from Local_Storage
4. IF Local_Storage contains no transactions, THEN THE Expense_Visualizer SHALL display an empty Transaction_List indicating that no transactions have been recorded
5. IF Local_Storage is unavailable, THEN THE Expense_Visualizer SHALL display an empty Transaction_List and indicate that transactions could not be loaded

### Requirement 4: Transaction Deletion

**User Story:** As a user, I want to delete a transaction, so that I can remove incorrect or unwanted entries.

#### Acceptance Criteria

1. THE Expense_Visualizer SHALL provide a delete control for each transaction in the Transaction_List
2. WHEN a user activates the delete control for a transaction, THE Expense_Visualizer SHALL remove that specific transaction from the Transaction_List without modifying any other transactions
3. WHEN a transaction is deleted, THE Expense_Visualizer SHALL remove the deleted transaction from the stored transactions in Local_Storage
4. IF the storage update fails after the transaction has been removed from the Transaction_List, THEN THE Expense_Visualizer SHALL restore the transaction to the list and display an error message

### Requirement 5: Total Balance Display

**User Story:** As a user, I want to see my total balance, so that I can understand my overall spending at a glance.

#### Acceptance Criteria

1. THE Expense_Visualizer SHALL display the Balance above the Transaction_List and Pie_Chart in the interface
2. THE Expense_Visualizer SHALL compute the Balance as the sum of all transaction amounts, which is 0 when no transactions exist
3. WHEN a transaction is added or deleted, THE Expense_Visualizer SHALL recompute and display the updated Balance
4. WHEN the page loads, THE Expense_Visualizer SHALL compute and display the Balance from the transactions loaded from Local_Storage

### Requirement 6: Spending Distribution Chart

**User Story:** As a user, I want to see a pie chart of my spending by category, so that I can visualize how my spending is distributed.

#### Acceptance Criteria

1. WHILE one or more transactions exist, THE Expense_Visualizer SHALL display a Pie_Chart showing spending distribution by category
2. THE Expense_Visualizer SHALL compute each Pie_Chart segment as the sum of transaction amounts within that category
3. THE Expense_Visualizer SHALL ensure the sum of all Pie_Chart segment values equals the sum of all transaction amounts
4. WHEN a transaction is added, deleted, or modified, THE Expense_Visualizer SHALL recompute each Pie_Chart segment from the current transactions and update the displayed Pie_Chart
5. IF no transactions exist, THEN THE Expense_Visualizer SHALL not display a Pie_Chart and shall indicate that no spending data is available

### Requirement 7: Custom Categories

**User Story:** As a user, I want to add custom categories, so that I can classify transactions beyond the defaults.

#### Acceptance Criteria

1. WHERE custom categories are enabled, THE Expense_Visualizer SHALL allow users to add a new category name
2. WHEN a custom category is added, THE Expense_Visualizer SHALL make the category available for selection in the input form
3. WHEN a custom category is added, THE Expense_Visualizer SHALL persist the category in Local_Storage
4. IF a custom category name is empty, contains only whitespace characters, exceeds 50 characters, or case-insensitively matches an existing default or custom category, THEN THE Expense_Visualizer SHALL display a validation message indicating the specific reason and reject the category

### Requirement 8: Transaction Sorting

**User Story:** As a user, I want to sort transactions by amount or category, so that I can organize my spending history.

#### Acceptance Criteria

1. WHERE sorting is enabled, THE Expense_Visualizer SHALL provide a control to sort transactions by amount or by category
2. WHEN a sort option of amount is selected, THE Expense_Visualizer SHALL reorder the Transaction_List in ascending order of transaction amount
3. WHEN the Transaction_List is sorted, THE Expense_Visualizer SHALL produce a list containing the same transactions present before sorting
4. WHEN an already sorted Transaction_List is sorted again using the same option, THE Expense_Visualizer SHALL produce the same order
5. WHEN a sort option of category is selected, THE Expense_Visualizer SHALL reorder the Transaction_List in ascending alphabetical order of category name
6. WHEN the Transaction_List is sorted, THE Expense_Visualizer SHALL preserve the relative order of transactions that share the same sort key from before sorting

### Requirement 9: Dark and Light Theme

**User Story:** As a user, I want to toggle between dark and light modes, so that I can use the application comfortably in different lighting conditions.

#### Acceptance Criteria

1. THE Expense_Visualizer SHALL provide a theme toggle that switches the interface to the opposite Theme
2. WHEN a theme is selected, THE Expense_Visualizer SHALL apply the selected theme to all visible interface elements
3. WHEN a theme is selected, THE Expense_Visualizer SHALL persist the theme preference in Local_Storage
4. WHEN the page loads, THE Expense_Visualizer SHALL apply the theme stored in Local_Storage
5. WHEN the page loads and no theme preference is stored in Local_Storage, THE Expense_Visualizer SHALL apply the default light theme

### Requirement 10: Data Persistence

**User Story:** As a user, I want my transactions and preferences to persist between sessions, so that I do not lose data when I close the browser.

#### Acceptance Criteria

1. WHEN the page loads, THE Expense_Visualizer SHALL load all transactions, custom categories, and the theme from Local_Storage
2. WHEN a transaction or custom category is added or deleted, THE Expense_Visualizer SHALL persist the change to Local_Storage
3. WHEN transactions are saved to Local_Storage and subsequently loaded, THE Expense_Visualizer SHALL produce transactions with the same name, amount, and category as those saved
4. IF Local_Storage is unavailable or contains no valid stored data when the page loads, THEN THE Expense_Visualizer SHALL initialize with no transactions, default categories, and default theme
5. IF a write to Local_Storage fails, THEN THE Expense_Visualizer SHALL display an error message indicating the data could not be saved and retain the current transactions and custom categories

### Requirement 11: Responsive Mobile Layout

**User Story:** As a user, I want the application to work well on my phone, so that I can track spending on the go.

#### Acceptance Criteria

1. WHILE the viewport width is between 320 and 480 pixels inclusive, THE Expense_Visualizer SHALL render all controls and content fully visible within the viewport
2. WHILE the viewport width is between 320 and 480 pixels inclusive, THE Expense_Visualizer SHALL display all controls and content without requiring horizontal scrolling
