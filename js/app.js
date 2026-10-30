﻿/* Expense & Budget Visualizer - Application Logic */

/*
  Module structure scaffold.
  All modules live inside this single file. There is no module bundler and no
  build step. Each module is a plain object (or function group) that owns a
  distinct responsibility. A central Controller wires DOM events to state
  mutations and re-renders.
*/

// ===== State Module =====
// Holds in-memory `transactions`, `categories`, and `theme`.
// Provides accessors to read and mutate state. State mutations are the
// single entry point for changes; every mutation notifies a listener
// (the Controller, wired in task 10.0) so it can persist and re-render.
// Implemented in task 3.0.
const State = (function () {
  // Generates a unique id for a new transaction. Prefers crypto.randomUUID
  // and falls back to a time + randomness based id when it is unavailable.
  function generateId() {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
      return crypto.randomUUID();
    }
    return Date.now().toString(36) + Math.random().toString(36).slice(2);
  }

  // The in-memory application state, kept private so all changes flow
  // through the accessors below.
  const state = {
    transactions: [],                        // array of Transaction objects
    categories: ["Food", "Transport", "Fun"], // default category labels
    theme: "light",                          // "dark" | "light"
  };

  // Mutation hook. The Controller registers a callback via subscribe() so
  // that every mutation triggers persistence and a re-render. Until the
  // Controller is wired this stays null and mutations are silent with
  // respect to persistence/rendering (no-op behavior).
  let onChange = null;

  // Invoked after every mutation. Forwards the change kind
  // ("transactions" | "categories" | "theme") to an available listener:
  // a registered onChange callback first, then a guarded Controller call.
  function notify(kind) {
    if (typeof onChange === "function") {
      onChange(kind);
      return;
    }
    // Forward-compatible fallback: if the Controller exposes persist/render
    // directly (task 10.0 may wire either way), call them when available.
    if (typeof Controller !== "undefined" && Controller) {
      if (typeof Controller.persist === "function") Controller.persist(kind);
      if (typeof Controller.render === "function") Controller.render();
    }
  }

  return {
    // ---- Transactions ----

    // Returns the transactions array.
    getTransactions() {
      return state.transactions;
    },

    // Creates a Transaction object with a unique id and createdAt timestamp,
    // appends it to the transactions array, notifies listeners, and returns
    // the added transaction.
    addTransaction(name, amount, category) {
      const transaction = {
        id: generateId(),
        name: name,
        amount: amount,
        category: category,
        createdAt: Date.now(),
      };
      state.transactions.push(transaction);
      notify("transactions");
      return transaction;
    },

    // Removes the transaction matching `id` and returns it. Returns null when
    // no matching transaction is found. Other transactions are left untouched.
    deleteTransaction(id) {
      const transactions = state.transactions;
      for (let i = 0; i < transactions.length; i++) {
        if (transactions[i].id === id) {
          const removed = transactions.splice(i, 1)[0];
          notify("transactions");
          return removed;
        }
      }
      return null;
    },

    // ---- Categories ----

    // Returns the categories array.
    getCategories() {
      return state.categories;
    },

    // Adds a category name when it is not already present (case-insensitive).
    // Returns true if the category was added, false if it was a duplicate.
    addCategory(name) {
      const lower = String(name).toLowerCase();
      const exists = state.categories.some(
        (c) => String(c).toLowerCase() === lower
      );
      if (exists) {
        return false;
      }
      state.categories.push(name);
      notify("categories");
      return true;
    },

    // Removes a category by name (case-insensitive). Returns true when
    // removed, false when not found. Does not allow removing the last
    // remaining category so the form always has at least one option.
    deleteCategory(name) {
      if (state.categories.length <= 1) {
        return false;
      }
      const lower = String(name).toLowerCase();
      const idx = state.categories.findIndex(
        (c) => String(c).toLowerCase() === lower
      );
      if (idx === -1) {
        return false;
      }
      state.categories.splice(idx, 1);
      notify("categories");
      return true;
    },

    // ---- Theme ----

    // Returns the current theme ("dark" | "light").
    getTheme() {
      return state.theme;
    },

    // Sets the current theme. Expected values are "dark" or "light".
    setTheme(theme) {
      state.theme = theme;
      notify("theme");
    },

    // ---- Initialization support (used by the Controller in task 10.0) ----

    // Replaces the in-memory state with the supplied data. Intended for the
    // initial load from Local Storage; does not notify so the Controller can
    // render once after loading completes.
    setState({ transactions, categories, theme } = {}) {
      if (Array.isArray(transactions)) state.transactions = transactions;
      if (Array.isArray(categories)) state.categories = categories;
      if (typeof theme === "string") state.theme = theme;
    },

    // ---- Mutation hook (for the Controller, task 10.0) ----

    // Registers a callback invoked after every state mutation. The callback
    // receives the change kind ("transactions" | "categories" | "theme").
    subscribe(callback) {
      onChange = callback;
    },
  };
})();

// ===== Storage Module =====
// Reads and writes the Local Storage keys ev_transactions, ev_categories,
// and ev_theme. JSON.parse is wrapped in error handling that falls back
// to defaults on missing or malformed data. All localStorage access is
// guarded with try/catch so the app keeps working (with defaults) when
// storage is unavailable (private mode, disabled storage, or a
// SecurityError), satisfying Req 10.4.
// Implemented in task 4.0.
const Storage = {
  // Centralized Local Storage key names so reads and writes stay in sync.
  KEYS: {
    transactions: "ev_transactions",
    categories: "ev_categories",
    theme: "ev_theme",
  },

  // Default values used when storage is missing, malformed, or unavailable.
  DEFAULTS: {
    transactions: [],
    categories: ["Food", "Transport", "Fun"],
    theme: "light",
  },

  // Safely reads a localStorage key. Returns null when storage is
  // unavailable, the key is missing, or access throws. The caller decides
  // how to map null onto a default value.
  _read(key) {
    try {
      return localStorage.getItem(key);
    } catch (e) {
      // localStorage may be disabled (private mode, restrictions, or a
      // SecurityError). Treat as "no stored value".
      return null;
    }
  },

  // Safely writes a value to a localStorage key. Returns true on success
  // and false when the write fails (quota exceeded, storage disabled, or a
  // SecurityError). Callers use the boolean to satisfy Req 10.5: a failed
  // write should surface an error while retaining the current data.
  _write(key, value) {
    try {
      localStorage.setItem(key, value);
      return true;
    } catch (e) {
      return false;
    }
  },

  // Parses a JSON string with error handling. Returns the parsed value on
  // success, or `fallback` when the input is null/undefined or malformed.
  // This is the error-handling wrapper required by task 4.5.
  _parseJSON(raw, fallback) {
    if (raw == null) {
      return fallback;
    }
    try {
      return JSON.parse(raw);
    } catch (e) {
      return fallback;
    }
  },

  // loadState(): reads ev_transactions, ev_categories, and ev_theme from
  // Local Storage, parses JSON where applicable, and returns a state
  // object { transactions, categories, theme } with defaults on missing or
  // malformed data. Safe to call when localStorage is unavailable. The
  // returned object is a fresh snapshot the Controller can hand to
  // State.setState(...) (Req 10.1).
  loadState() {
    // Transactions: stored as a JSON array. Fall back to an empty array
    // when the value is missing, unparseable, or not an array.
    let transactions = this._parseJSON(
      this._read(this.KEYS.transactions),
      this.DEFAULTS.transactions
    );
    if (!Array.isArray(transactions)) {
      transactions = this.DEFAULTS.transactions;
    }

    // Categories: stored as a JSON array. Fall back to the default
    // categories when the value is missing, unparseable, or not an array.
    let categories = this._parseJSON(
      this._read(this.KEYS.categories),
      this.DEFAULTS.categories
    );
    if (!Array.isArray(categories)) {
      categories = this.DEFAULTS.categories;
    }

    // Theme: stored as a plain string ("dark" | "light"), not JSON. Validate
    // the stored value and fall back to the default when it is missing or
    // holds something unexpected (Req 9.4, 9.5).
    const themeRaw = this._read(this.KEYS.theme);
    let theme = themeRaw == null ? this.DEFAULTS.theme : themeRaw;
    if (theme !== "dark" && theme !== "light") {
      theme = this.DEFAULTS.theme;
    }

    return { transactions, categories, theme };
  },

  // saveTransactions(): serializes the transactions array (from
  // State.getTransactions()) to ev_transactions using JSON.stringify. Safe
  // to call even when State holds no transactions (it writes "[]").
  // Returns true on success, false when the write fails (Req 1.3, 4.3,
  // 10.2).
  saveTransactions() {
    return this._write(
      this.KEYS.transactions,
      JSON.stringify(State.getTransactions())
    );
  },

  // saveCategories(): serializes the categories array (from
  // State.getCategories()) to ev_categories using JSON.stringify. Safe to
  // call even when State holds only the default categories. Returns true on
  // success, false when the write fails (Req 7.3, 10.2).
  saveCategories() {
    return this._write(
      this.KEYS.categories,
      JSON.stringify(State.getCategories())
    );
  },

  // saveTheme(): writes the theme string (from State.getTheme()) to
  // ev_theme. The theme is stored as a plain string (not JSON) per the
  // storage schema. Returns true on success, false when the write fails
  // (Req 9.3, 10.2).
  saveTheme() {
    return this._write(this.KEYS.theme, State.getTheme());
  },
};

// ===== Validation Module =====
// Pure functions that take inputs and return a validation result
// { valid: boolean, message: string } without side effects.
// Implemented in task 5.0.
const Validation = {
  // validateTransaction(name, amount, category)
  //
  // Pure validation for a transaction submission. Returns a result object
  // { valid: boolean, message: string }. The function does not touch the
  // DOM, Local Storage, or State; it only inspects its arguments.
  //
  // Rejection rules (Req 1.2, 2.1, 2.2):
  //   - name is empty or whitespace-only
  //   - amount is missing, non-numeric, NaN, non-finite, zero, negative,
  //     or outside the 0.01â€“999999.99 range
  //   - category is not selected (null/undefined/empty/whitespace)
  //
  // The amount may arrive as a string (the .value of a form input is always
  // a string); it is coerced with Number() and rejected when it does not
  // parse to a finite positive number. All detected issues are collected so
  // the message can indicate each missing/invalid field (Req 2.1).
  validateTransaction(name, amount, category) {
    const issues = [];

    // ---- Name ----
    // A name of null/undefined or one that is empty/whitespace-only is
    // treated as missing (Req 2.1).
    if (name == null || String(name).trim() === "") {
      issues.push("name is missing");
    }

    // ---- Amount ----
    // Detect a missing amount before coercion, because Number("") and
    // Number("   ") evaluate to 0 (which would otherwise look like a
    // non-positive value rather than a missing one).
    if (amount == null || String(amount).trim() === "") {
      issues.push("amount is missing");
    } else {
      const numAmount = Number(amount);
      // isFinite rejects NaN and Infinity; Number("abc") is NaN, etc.
      if (!isFinite(numAmount)) {
        issues.push("amount is not a valid number");
      } else if (numAmount <= 0) {
        // Catches zero and negative values (Req 2.2).
        issues.push("amount must be a positive number");
      } else if (numAmount < 1 || numAmount > 999999999) {
        // Enforce Rupiah range: minimum Rp 1, maximum Rp 999.999.999
        issues.push("jumlah harus antara Rp 1 dan Rp 999.999.999");
      }
    }

    // ---- Category ----
    // A category is "not selected" when it is null/undefined or empty/
    // whitespace-only (Req 2.1).
    if (category == null || String(category).trim() === "") {
      issues.push("category is missing");
    }

    if (issues.length > 0) {
      return { valid: false, message: issues.join("; ") + "." };
    }
    return { valid: true, message: "" };
  },

  // validateCategory(name, existingCategories)
  //
  // Pure validation for a custom-category submission. Returns a result
  // object { valid: boolean, message: string }. `existingCategories` is an
  // array of category-name strings (e.g. State.getCategories()). The
  // function has no side effects.
  //
  // Rejection rules (Req 7.4):
  //   - name is empty or whitespace-only
  //   - name exceeds 50 characters (measured on the trimmed name)
  //   - name case-insensitively matches an existing category
  //
  // The name is trimmed before all checks so surrounding whitespace is
  // treated as input noise; the duplicate comparison is case-insensitive
  // (Req 7.4). The first failing rule determines the message, which
  // indicates the specific reason (Req 7.4).
  validateCategory(name, existingCategories) {
    // Treat null/undefined/empty/whitespace-only as missing.
    if (name == null || String(name).trim() === "") {
      return { valid: false, message: "Category name is missing." };
    }

    const trimmed = String(name).trim();

    // Enforce the 50-character maximum on the meaningful name (Req 7.4).
    if (trimmed.length > 50) {
      return {
        valid: false,
        message: "Category name must not exceed 50 characters.",
      };
    }

    // Case-insensitive duplicate check against existing categories.
    // Existing entries are also trimmed for a consistent comparison so
    // "Food" and " food " are treated as the same category.
    const lower = trimmed.toLowerCase();
    const categories = Array.isArray(existingCategories)
      ? existingCategories
      : [];
    const isDuplicate = categories.some(function (c) {
      return c != null && String(c).trim().toLowerCase() === lower;
    });
    if (isDuplicate) {
      return { valid: false, message: "Category name already exists." };
    }

    return { valid: true, message: "" };
  },
};

// ===== Render Module =====
// Idempotent functions that read current state and replace the relevant
// DOM region. Same state produces the same output. Each function reads
// current state via the State module and clears-and-rebuilds its DOM region
// rather than appending, so calling a render function twice with identical
// state yields identical DOM (Req 3.1, 3.2, 3.4, 4.1, 5.2, 7.2; Properties 1,
// 9). No event listeners are attached here â€” that is the Controller's job
// (task 10.0); the Render module only builds DOM structure, including delete
// controls that carry identifying data for the Controller to wire up.
// Implemented in task 6.0.
const Render = {
  // formatAmount(value): formats a numeric amount as a fixed 2-decimal-place
  // string (e.g. 12.5 -> "12.50"). Used for both the balance and per-
  // transaction amounts so formatting stays consistent across the interface.
  // Non-numeric or missing values are treated as 0 to keep the display
  // stable when a transaction object is malformed.
  formatAmount(value) {
    const num = Number(value);
    if (!isFinite(num)) {
      return "Rp 0";
    }
    // Format as Rupiah: integer, thousands separator dot
    const rounded = Math.round(num);
    const parts = rounded.toString().split("");
    let result = "";
    for (let i = 0; i < parts.length; i++) {
      if (i > 0 && (parts.length - i) % 3 === 0) {
        result += ".";
      }
      result += parts[i];
    }
    return "Rp " + result;
  },

  // renderBalance(): computes the sum of all transaction amounts (from
  // State.getTransactions()) and updates the #balance display element's
  // text content, formatted to 2 decimal places. The balance is "0.00" when
  // no transactions exist (Req 5.2). Guarded so a missing element is a no-op.
  // Idempotent: identical transactions produce the same displayed value,
  // satisfying Property 1 (balance == sum of amounts).
  renderBalance() {
    const balanceEl = document.getElementById("balance");
    if (!balanceEl) {
      return;
    }
    const transactions = State.getTransactions();
    let total = 0;
    for (let i = 0; i < transactions.length; i++) {
      const amt = Number(transactions[i].amount);
      if (isFinite(amt)) {
        total += amt;
      }
    }
    balanceEl.textContent = this.formatAmount(total);
  },

  // renderList(sortedTransactions): rebuilds the #transaction-list <ul> from
  // a transactions array, creating one <li> per transaction that shows the
  // name, amount, and category, each with a delete control button
  // (Req 3.2, 4.1).
  //
  // When `sortedTransactions` is provided (a pre-sorted array from the Sort
  // module), that array is used as-is and displayed in the given order. When
  // omitted or null, the function falls back to State.getTransactions() and
  // iterates in reverse (newest first, Req 3.1): State appends new
  // transactions to the end of the array, so iterating in reverse puts the
  // newest entry at the top.
  //
  // The #empty-list-message indicator is shown when no transactions exist and
  // hidden otherwise (Req 3.4). Each delete button carries a `data-id`
  // attribute matching the transaction id (and so does the <li>) so the
  // Controller can identify the target transaction â€” typically via event
  // delegation on the list. No listeners are attached here.
  renderList(sortedTransactions) {
    const listEl = document.getElementById("transaction-list");
    const emptyMsgEl = document.getElementById("empty-list-message");
    if (!listEl) {
      return;
    }

    // When a sorted array is supplied by the Controller (task 10.5), use it
    // directly; otherwise fall back to the canonical State order.
    const useSorted = Array.isArray(sortedTransactions);
    const transactions = useSorted
      ? sortedTransactions
      : State.getTransactions();

    // Clear existing items first so re-rendering is idempotent and never
    // appends duplicates.
    listEl.innerHTML = "";

    if (transactions.length === 0) {
      // Show the empty-list indicator (Req 3.4) and stop.
      if (emptyMsgEl) {
        emptyMsgEl.hidden = false;
      }
      return;
    }

    if (emptyMsgEl) {
      emptyMsgEl.hidden = true;
    }

    // When rendering a sorted view, iterate forward (the Sort module already
    // determined the order). When rendering the canonical state order, iterate
    // in reverse so the most recently recorded transaction (last pushed into
    // State) appears first (Req 3.1). This reads State without mutating it.
    const start = useSorted ? 0 : transactions.length - 1;
    const end   = useSorted ? transactions.length : -1;
    const step  = useSorted ? 1 : -1;
    for (let i = start; i !== end; i += step) {
      const t = transactions[i];

      const li = document.createElement("li");
      li.className = "transaction-item";
      li.setAttribute("data-id", t.id);

      // Name
      const nameEl = document.createElement("span");
      nameEl.className = "transaction-name";
      nameEl.textContent = t.name != null ? String(t.name) : "";
      li.appendChild(nameEl);

      // Amount (formatted to 2 decimals for consistency with the balance)
      const amountEl = document.createElement("span");
      amountEl.className = "transaction-amount";
      amountEl.textContent = this.formatAmount(t.amount);
      li.appendChild(amountEl);

      // Category
      const categoryEl = document.createElement("span");
      categoryEl.className = "transaction-category";
      categoryEl.textContent = t.category != null ? String(t.category) : "";
      li.appendChild(categoryEl);

      // Delete control â€” carries data-id so the Controller can identify the
      // target transaction (Req 4.1). textContent (not innerHTML) keeps
      // user-supplied names safely escaped. No listener attached here.
      const deleteBtn = document.createElement("button");
      deleteBtn.type = "button";
      deleteBtn.className = "delete-transaction";
      deleteBtn.setAttribute("data-id", t.id);
      deleteBtn.setAttribute(
        "aria-label",
        "Delete " + (t.name != null ? String(t.name) : "transaction")
      );
      deleteBtn.textContent = "Delete";
      li.appendChild(deleteBtn);

      listEl.appendChild(li);
    }
  },

  // renderCategories(): rebuilds the #transaction-category select options from
  // the categories array (State.getCategories()). Preserves the default
  // placeholder option (<option value="">Select a category</option>) and adds
  // one <option> per category (Req 7.2). The currently selected category is
  // retained across the rebuild when it still exists; if the previously
  // selected category no longer exists, the selection resets to the
  // placeholder. Idempotent: identical categories produce identical option
  // markup. Guarded so a missing element is a no-op.
  renderCategories() {
    const selectEl = document.getElementById("transaction-category");
    if (!selectEl) {
      return;
    }

    const categories = State.getCategories();

    // Remember the current selection so it can be restored after rebuilding.
    const previousValue = selectEl.value;

    // Rebuild from scratch (placeholder + categories) to stay idempotent.
    selectEl.innerHTML = "";

    // Default placeholder option, kept in sync with index.html.
    const placeholder = document.createElement("option");
    placeholder.value = "";
    placeholder.textContent = "Select a category";
    placeholder.selected = true;
    selectEl.appendChild(placeholder);

    let stillExists = false;
    for (let i = 0; i < categories.length; i++) {
      const name = categories[i];
      const value = String(name);
      const option = document.createElement("option");
      option.value = value;
      option.textContent = value;
      if (value === previousValue) {
        stillExists = true;
      }
      selectEl.appendChild(option);
    }

    // Restore the previous selection when it is still a valid category;
    // otherwise the placeholder (already selected by default) remains.
    if (previousValue !== "" && stillExists) {
      selectEl.value = previousValue;
    }
  },

  // renderCategoryList(): rebuilds the #category-list <ul> showing all
  // current categories, each with a delete button. Event delegation on the
  // list is wired by the Controller so renderCategoryList only builds DOM.
  renderCategoryList() {
    const listEl = document.getElementById("category-list");
    if (!listEl) {
      return;
    }

    const categories = State.getCategories();
    listEl.innerHTML = "";

    for (let i = 0; i < categories.length; i++) {
      const name = categories[i];

      const li = document.createElement("li");
      li.className = "category-list-item";
      li.setAttribute("data-category", name);

      const nameSpan = document.createElement("span");
      nameSpan.className = "category-list-name";
      nameSpan.textContent = name;
      li.appendChild(nameSpan);

      // Only show delete button when more than one category exists
      if (categories.length > 1) {
        const deleteBtn = document.createElement("button");
        deleteBtn.type = "button";
        deleteBtn.className = "delete-category";
        deleteBtn.setAttribute("data-category", name);
        deleteBtn.setAttribute("aria-label", "Hapus kategori " + name);
        deleteBtn.textContent = "×";
        li.appendChild(deleteBtn);
      }

      listEl.appendChild(li);
    }
  },
};

// ===== Chart Module =====
// Renders the Pie_Chart as inline SVG (no external dependency, safe for
// browser-extension Content Security Policy). The chart aggregates
// transactions by category, computes each slice's angle from its share of
// the grand total, and draws <path> arcs into #chart-container. The SVG
// uses a relative viewBox (0 0 100 100) so it scales to the container width.
// Implemented in task 7.0.
const Chart = {
  // SVG namespace required for createElementNS when building inline SVG.
  SVG_NS: "http://www.w3.org/2000/svg",

  // Fixed palette of distinct hex colors. Categories are colored by their
  // index in the aggregated map's iteration order; the palette wraps around
  // when there are more categories than colors (task 7.3).
  PALETTE: [
    "#4f8cff", "#ff6b6b", "#51cf66", "#fcc419", "#cc5de8",
    "#22b8cf", "#ff922b", "#20c997", "#e64980", "#5c7cfa",
  ],

  // aggregateByCategory(transactions)
  //
  // PURE function. Returns a Map<string, number> mapping each category to
  // the sum of its transaction amounts. Does not mutate the input array or
  // any transaction object. Transactions with a missing/non-finite amount
  // or a missing category are skipped so they cannot corrupt the totals.
  //
  // Satisfies Property 2 (sum of all values == sum of all amounts) and
  // Property 3 (each value == sum of amounts in that category)
  // (Req 6.2, 6.3). Access values with map.get(category).
  aggregateByCategory(transactions) {
    const map = new Map();
    if (!Array.isArray(transactions)) {
      return map;
    }
    for (let i = 0; i < transactions.length; i++) {
      const t = transactions[i];
      if (!t || t.category == null) {
        continue;
      }
      const amt = Number(t.amount);
      if (!isFinite(amt)) {
        continue;
      }
      const category = String(t.category);
      map.set(category, (map.get(category) || 0) + amt);
    }
    return map;
  },

  // renderChart()
  //
  // Reads current transactions via State.getTransactions(), aggregates by
  // category, and draws the Pie_Chart as inline SVG into #chart-container.
  // The SVG uses a relative viewBox (0 0 100 100) so it scales to the
  // container width (design/Responsive Design). Idempotent: the container
  // is cleared before each draw so repeated calls with the same state
  // produce the same DOM (Req 6.1, 6.2, 6.3, 6.4; Properties 2, 3, 10).
  renderChart() {
    const container = document.getElementById("chart-container");
    const emptyMsg = document.getElementById("chart-empty-message");
    if (!container) {
      return;
    }

    const aggregated = this.aggregateByCategory(State.getTransactions());

    // Grand total = sum of all category aggregates, which equals the sum of
    // all transaction amounts (Property 2). Computed from the aggregated
    // map rather than re-summing transactions so it stays consistent with
    // the slice angles derived from the same values.
    let grandTotal = 0;
    aggregated.forEach((value) => {
      grandTotal += value;
    });

    // Empty state: no transactions or a zero/negative grand total. Show the
    // placeholder message and do not draw a chart, avoiding division by
    // zero when computing slice angles (Req 6.5; design/Error Handling).
    if (grandTotal <= 0) {
      this._clearChart(container);
      if (emptyMsg) {
        emptyMsg.hidden = false;
        // Ensure the placeholder lives inside the container.
        if (emptyMsg.parentElement !== container) {
          container.appendChild(emptyMsg);
        }
      }
      return;
    }

    // Spending data exists: hide the placeholder and draw the chart.
    if (emptyMsg) {
      emptyMsg.hidden = true;
    }
    this._clearChart(container);

    // Build an ordered slices array so slice drawing and the legend share
    // the same color assignment (task 7.3). Iteration order is the Map's
    // insertion order, which is deterministic for a given transaction set.
    const slices = [];
    let colorIndex = 0;
    aggregated.forEach((value, category) => {
      slices.push({
        category: category,
        value: value,
        color: this.PALETTE[colorIndex % this.PALETTE.length],
      });
      colorIndex++;
    });

    // Create the SVG element with a relative viewBox so it scales
    // responsively to the container width (design/Responsive Design).
    const svg = document.createElementNS(this.SVG_NS, "svg");
    svg.setAttribute("viewBox", "0 0 100 100");
    svg.setAttribute("preserveAspectRatio", "xMidYMid meet");
    svg.setAttribute("class", "pie-chart");
    svg.setAttribute("role", "img");
    svg.setAttribute("aria-label", "Spending distribution by category");

    // Pie geometry: center at (50, 50), radius 40 â€” leaves room for the
    // white stroke between slices and stays inside the 100Ã—100 viewBox.
    const cx = 50;
    const cy = 50;
    const r = 40;

    // Start at the top (12 o'clock, -Ï€/2) and sweep clockwise.
    let startAngle = -Math.PI / 2;

    for (let i = 0; i < slices.length; i++) {
      const slice = slices[i];
      const angle = (slice.value / grandTotal) * 2 * Math.PI;
      const endAngle = startAngle + angle;

      if (angle >= 2 * Math.PI - 1e-9) {
        // Full-circle slice (a single category accounts for all spending).
        // A single arc from a point back to itself is degenerate and
        // renders nothing in SVG, so draw a complete <circle> instead
        // (task 7.2).
        this._appendCircle(svg, cx, cy, r, slice.color);
      } else {
        const path = document.createElementNS(this.SVG_NS, "path");
        path.setAttribute("d", this._arcPath(cx, cy, r, startAngle, endAngle));
        path.setAttribute("fill", slice.color);
        path.setAttribute("stroke", "#ffffff");
        path.setAttribute("stroke-width", "1");
        path.setAttribute("stroke-linejoin", "round");
        svg.appendChild(path);
      }

      startAngle = endAngle;
    }

    container.appendChild(svg);

    // Append a simple legend mapping each category to its color and share.
    this._renderLegend(container, slices, grandTotal);
  },

  // _clearChart(container): removes any previously rendered SVG element
  // and legend from the chart container, leaving the static placeholder
  // paragraph intact. Idempotent â€” safe to call when nothing has been drawn
  // yet (task 7.5).
  _clearChart(container) {
    const children = container.children;
    // Iterate backwards so removing elements does not shift indices.
    for (let i = children.length - 1; i >= 0; i--) {
      const child = children[i];
      const tag = child.tagName.toLowerCase();
      if (tag === "svg" || child.getAttribute("data-chart-legend") === "true") {
        container.removeChild(child);
      }
    }
  },

  // _arcPath(cx, cy, r, a1, a2): returns the SVG path 'd' string for a pie
  // slice spanning from angle a1 to a2 (radians). The path moves to the
  // center, lines out to the arc start point, sweeps along the circle, and
  // closes back to the center. largeArc is 1 when the slice exceeds 180Â°
  // (task 7.2).
  _arcPath(cx, cy, r, a1, a2) {
    const startX = cx + r * Math.cos(a1);
    const startY = cy + r * Math.sin(a1);
    const endX = cx + r * Math.cos(a2);
    const endY = cy + r * Math.sin(a2);
    const largeArc = a2 - a1 > Math.PI ? 1 : 0;
    return (
      "M " + cx + "," + cy +
      " L " + startX + "," + startY +
      " A " + r + "," + r + " 0 " + largeArc + ",1 " + endX + "," + endY +
      " Z"
    );
  },

  // _appendCircle(svg, cx, cy, r, fill): draws a complete circle slice for
  // the 100% case where a single category accounts for all spending. Uses
  // an SVG <circle> element because a degenerate arc (start == end point)
  // renders nothing (task 7.2).
  _appendCircle(svg, cx, cy, r, fill) {
    const circle = document.createElementNS(this.SVG_NS, "circle");
    circle.setAttribute("cx", cx);
    circle.setAttribute("cy", cy);
    circle.setAttribute("r", r);
    circle.setAttribute("fill", fill);
    circle.setAttribute("stroke", "#ffffff");
    circle.setAttribute("stroke-width", "1");
    svg.appendChild(circle);
  },

  // _renderLegend(container, slices, grandTotal): appends a simple legend
  // listing each category with its color swatch, name, and percentage of
  // the total. Tagged with data-chart-legend so _clearChart can remove it
  // on the next redraw. Kept intentionally minimal (task 7.3).
  _renderLegend(container, slices, grandTotal) {
    const legend = document.createElement("div");
    legend.className = "chart-legend";
    legend.setAttribute("data-chart-legend", "true");

    for (let i = 0; i < slices.length; i++) {
      const slice = slices[i];
      const percent = ((slice.value / grandTotal) * 100).toFixed(1);

      const item = document.createElement("div");
      item.className = "legend-item";

      const swatch = document.createElement("span");
      swatch.className = "legend-swatch";
      swatch.style.backgroundColor = slice.color;
      item.appendChild(swatch);

      const label = document.createElement("span");
      label.className = "legend-label";
      label.textContent = slice.category + " - " + percent + "%";
      item.appendChild(label);

      legend.appendChild(item);
    }

    container.appendChild(legend);
  },
};

// ===== Sort Module =====
// Pure function that returns a NEW sorted array; does not mutate the input.
// Implemented in task 8.0.
const Sort = {
  // sortTransactions(transactions, option)
  //
  // PURE function. Returns a NEW array containing the same transaction
  // objects as the input, reordered by the given option. The input array is
  // never mutated and no transaction object is modified (Req 8.3; task 8.2;
  // Property 4 â€” the result is a permutation of the input).
  //
  // option:
  //   "amount"   -> ascending numeric order by transaction.amount (Req 8.2)
  //   "category" -> ascending alphabetical order by transaction.category
  //                 (Req 8.5)
  //
  // STABILITY (Req 8.6): transactions that share the same sort key keep the
  // relative order they had in the input. Stability is guaranteed by
  // construction via a Schwartzian transform (decorate-sort-undecorate):
  // each transaction is paired with its original index, which is used as a
  // tiebreaker when keys are equal. This makes the result independent of
  // whether the runtime's sort algorithm is itself stable.
  //
  // IDEMPOTENCE (Req 8.4; Property 5): sorting an already-sorted list with
  // the same option yields the same order. After the first sort, equal-key
  // items sit in ascending-index order; re-sorting pairs them with new
  // indices that are also ascending, so the tiebreaker preserves the order.
  //
  // DEFENSIVE INPUT HANDLING: a non-array input returns an empty array. An
  // unrecognized option (including the Controller's "none", which the
  // Controller owns per task 10.5) returns a shallow copy unchanged, so the
  // caller never shares or mutates the input array. Malformed entries
  // (missing/non-finite amount, missing category) are coerced to safe
  // defaults rather than skipped, so the output stays a true permutation.
  sortTransactions(transactions, option) {
    // Non-array input cannot be sorted; return an empty array so callers
    // never receive null/undefined and iteration stays safe.
    if (!Array.isArray(transactions)) {
      return [];
    }

    // For an unrecognized option (or "none"), return a shallow copy of the
    // input unchanged. Returning a copy â€” not the original reference â€” keeps
    // the "does not mutate the input" contract uniform for every caller and
    // ensures the caller's array identity is never shared.
    if (option !== "amount" && option !== "name") {
      return transactions.slice();
    }

    // Decorate: pair each transaction with its original index. The index is
    // the stable tiebreaker used when two transactions share a sort key.
    const decorated = transactions.map(function (t, i) {
      return { item: t, index: i };
    });

    // Sort the decorated array. The comparator extracts a sort key from each
    // transaction and, when the keys are equal, falls back to the original
    // index to preserve the input's relative order (stable sort, Req 8.6).
    decorated.sort(function (a, b) {
      let keyA;
      let keyB;

      if (option === "amount") {
        // Numeric ascending order (Req 8.2). Coerce amounts to numbers and
        // collapse any non-finite value (NaN/Infinity from malformed data)
        // to 0 so the comparator is a total order and deterministic across
        // engines â€” a NaN comparison would otherwise be engine-dependent.
        keyA = Number(a.item && a.item.amount);
        keyB = Number(b.item && b.item.amount);
        if (!isFinite(keyA)) keyA = 0;
        if (!isFinite(keyB)) keyB = 0;
      } else {
        // option === "name": ascending alphabetical order by transaction name.
        // Case-insensitive so "warnet" and "Warnet" sort together.
        keyA = String((a.item && a.item.name) || "").toLowerCase();
        keyB = String((b.item && b.item.name) || "").toLowerCase();
      }

      if (keyA < keyB) return -1;
      if (keyA > keyB) return 1;

      // Equal sort keys: preserve the input's relative order by comparing
      // original indices. This is what makes the sort stable (Req 8.6).
      return a.index - b.index;
    });

    // Undecorate: strip the index wrappers, returning only the transactions
    // in their new order. The transaction objects are unchanged and still
    // shared by reference with the input â€” only the array is new.
    return decorated.map(function (d) {
      return d.item;
    });
  },
};

// ===== Theme Module =====
// Sets the `data-theme` attribute on the root <html> element and persists
// the theme. CSS variables handle the restyling.
// Implemented in task 9.0.
const Theme = {
  // applyTheme(theme)
  //
  // Applies the given theme to every visible interface element and persists
  // the preference. CSS custom properties (defined in task 11.0 under
  // [data-theme="light"] and [data-theme="dark"]) do the actual restyling, so
  // a single attribute change on <html> restyles the whole interface without
  // any per-element JavaScript styling (Req 9.2; design/Theme Implementation).
  //
  // Steps:
  //   1. Normalize `theme` to "dark" or "light". Any unrecognized value
  //      (null, undefined, empty string, "blue", ...) falls back to the
  //      default "light" theme (Req 9.5). This keeps the DOM attribute and
  //      stored value always valid even when fed unexpected input.
  //   2. Update the in-memory state via State.setTheme(theme) BEFORE
  //      persisting. This is required because Storage.saveTheme() reads the
  //      current theme from State.getTheme(), so the state must hold the new
  //      theme first. State.setTheme also notifies subscribers; the
  //      Controller (task 10.0) is responsible for not re-entering
  //      applyTheme from that notification (it should not route "theme"
  //      changes back through applyTheme, since applyTheme already performs
  //      the DOM update and persistence).
  //   3. Set the `data-theme` attribute on the root <html> element
  //      (document.documentElement). This is the single switch that makes CSS
  //      variables resolve to the chosen palette (Req 9.2; design/Theme
  //      Implementation).
  //   4. Persist the theme to Local Storage via Storage.saveTheme() (Req 9.3).
  //      saveTheme() returns true on success and false when the write fails.
  //
  // Returns the boolean from Storage.saveTheme() â€” true when the theme was
  // persisted successfully, false when the Local Storage write failed â€” so the
  // Controller can surface an error message per Req 10.5. Note that the
  // in-memory state and the DOM attribute are updated regardless of whether
  // persistence succeeds, so the visible theme still switches even if storage
  // is unavailable; only the across-reload persistence is at risk.
  applyTheme(theme) {
    // Normalize: only "dark" and "light" are valid themes. Anything else
    // (including null/undefined/empty/non-string) defaults to "light"
    // (Req 9.5). Using an explicit check (rather than truthiness) ensures an
    // empty string also resolves to "light".
    const normalized = theme === "dark" ? "dark" : "light";

    // Update in-memory state first so State.getTheme() â€” and therefore
    // Storage.saveTheme() â€” reflect the new theme. State.setTheme stores the
    // value and notifies subscribers via notify("theme").
    State.setTheme(normalized);

    // Apply the theme to the DOM. Setting the data-theme attribute on the
    // root <html> element switches the CSS custom-property values, which
    // restyles every component that references those variables (Req 9.2;
    // design/Theme Implementation). document.documentElement is always the
    // <html> element.
    document.documentElement.setAttribute("data-theme", normalized);

    // Persist the theme preference to Local Storage (Req 9.3).
    // Storage.saveTheme() reads State.getTheme() (now updated above) and
    // writes it to the ev_theme key. Returns true on success, false on a
    // failed write (e.g. storage disabled or a SecurityError), which the
    // caller can use to satisfy Req 10.5.
    return Storage.saveTheme();
  },

  // toggleTheme()
  //
  // Switches the interface to the opposite theme and persists it. Reads the
  // current theme from State.getTheme(), flips "dark" <-> "light", then
  // delegates to applyTheme() for the state update, DOM update, and
  // persistence (Req 9.1). Delegating to applyTheme keeps a single code path
  // for "apply + persist a theme", so the normalization, DOM, state, and
  // storage logic live in one place.
  //
  // The opposite is computed as: if the current theme is "dark", switch to
  // "light"; otherwise (including "light" or any unexpected value) switch to
  // "dark". applyTheme then re-normalizes this result, so an unexpected
  // current theme still yields a valid theme.
  //
  // Returns the same boolean as applyTheme() (true on successful
  // persistence, false on a failed write) so the Controller can react to a
  // failed Local Storage write per Req 10.5.
  toggleTheme() {
    const current = State.getTheme();
    const next = current === "dark" ? "light" : "dark";
    return this.applyTheme(next);
  },
};

// ===== Controller / Event Wiring =====
// Initializes on DOMContentLoaded: loads state, applies the theme, renders
// the balance/list/categories/chart, and attaches event listeners.
// Implemented in task 10.0.
const Controller = {
  // _showValidationMessage(elementId, message)
  //
  // Sets the text content of a validation message element. Pass an empty
  // string to clear a previously shown message. Guarded so a missing element
  // is a no-op.
  _showValidationMessage(elementId, message) {
    const el = document.getElementById(elementId);
    if (el) {
      el.textContent = message;
    }
  },

  // init()
  //
  // Entry point called on DOMContentLoaded (task 10.1). Loads persisted
  // state, applies the stored theme, performs the initial render, and wires
  // all event listeners. The sequence is:
  //   1. Load state from Local Storage (Req 10.1).
  //   2. Push the loaded data into the in-memory State module (Req 10.1).
  //   3. Apply the stored theme so the UI adopts the right palette before
  //      any content is painted (Req 9.4).
  //   4. Render balance, list, categories, and chart to reflect stored state
  //      (Req 3.3, 5.4, 6.4 on load).
  //   5. Wire all event listeners.
  init() {
    // ---- 1 & 2: Load and restore persisted state ----
    const persisted = Storage.loadState();
    State.setState(persisted);

    // ---- 3: Apply the stored (or default) theme ----
    // applyTheme normalizes the value, updates State and the DOM attribute,
    // and re-persists â€” a no-op write if the value has not changed (Req 9.4).
    Theme.applyTheme(persisted.theme);

    // ---- 4: Initial render ----
    Render.renderBalance();
    Render.renderCategories();
    Render.renderCategoryList();
    Controller._renderListWithSort();
    Chart.renderChart();

    // ---- 5: Wire event listeners ----
    this._wireFormSubmit();
    this._wireAddCategory();
    this._wireDeleteCategory();
    this._wireDeleteTransaction();
    this._wireSortSelect();
    this._wireThemeToggle();
  },

  // _wireDeleteTransaction()
  //
  // Wires transaction deletion via event delegation on #transaction-list
  // (task 10.4). A single listener on the list container handles clicks on
  // any .delete-transaction button, even after the list is rebuilt by
  // re-renders (Req 4.1, 4.2). Delegation is essential here because
  // renderList() replaces the entire list contents on every re-render, so
  // listeners attached directly to individual buttons would be lost.
  //
  // On each matching click:
  //   1. Read the transaction id from the button's data-id attribute.
  //   2. Remove the transaction from in-memory state via
  //      State.deleteTransaction(id) (Req 4.2). The removed transaction is
  //      retained so it can be restored if persistence fails.
  //   3. Attempt to persist the updated list via Storage.saveTransactions().
  //      If the write fails (returns false):
  //        - Re-add the transaction to state to keep the in-memory list
  //          consistent with what the user sees (Req 4.4).
  //        - Re-render so the restored transaction reappears in the UI.
  //        - Display an error message near the list (Req 4.4, 10.5).
  //   4. On a successful write: re-render the balance, list, and chart to
  //      reflect the removal (Req 4.2, 5.3, 6.4).
  _wireDeleteTransaction() {
    const listEl = document.getElementById("transaction-list");
    if (!listEl) {
      return;
    }

    listEl.addEventListener("click", function (event) {
      // Walk up from the event target to find a .delete-transaction button.
      // This handles clicks on child elements (e.g. button text nodes) in
      // browsers that report the inner node as the target.
      let btn = event.target;
      while (btn && btn !== listEl) {
        if (
          btn.nodeName === "BUTTON" &&
          btn.classList.contains("delete-transaction")
        ) {
          break;
        }
        btn = btn.parentElement;
      }

      // If no matching button was found in the delegation chain, ignore.
      if (!btn || !btn.classList.contains("delete-transaction")) {
        return;
      }

      const id = btn.getAttribute("data-id");
      if (!id) {
        return;
      }

      // Remove from in-memory state and keep a reference in case we need to
      // restore it (Req 4.4). deleteTransaction returns the removed object
      // or null when the id is not found.
      const removed = State.deleteTransaction(id);

      if (!removed) {
        // The transaction was not found â€” nothing to restore or re-render.
        return;
      }

      // Attempt to persist the deletion (Req 4.3).
      const saved = Storage.saveTransactions();

      if (!saved) {
        // Persistence failed: restore the transaction to state so the UI
        // stays consistent with the persisted data (Req 4.4). We re-insert
        // the original transaction object directly into the state array so
        // its id and createdAt are preserved. State does not expose an
        // "insert at position" API, so we use addTransaction for a new
        // append and then fix up the fields, OR we simply push directly.
        // To keep the approach minimal, add back via State's internal array
        // by re-using the removed object: call addTransaction (which
        // generates a new id/timestamp) is NOT correct here because we need
        // to preserve the original id and createdAt. Instead, we rely on the
        // fact that State.setState merges arrays without notifying, so we
        // reconstruct the transactions array by appending the removed item
        // and pass it back through setState (which also does not notify).
        // We then manually re-render to reflect the restored state.
        const restored = State.getTransactions().concat([removed]);
        State.setState({ transactions: restored });

        // Re-render so the restored transaction appears in the list.
        Render.renderBalance();
        Controller._renderListWithSort();
        Chart.renderChart();

        // Show the error message below the transaction list (Req 4.4, 10.5).
        Controller._showValidationMessage(
          "delete-error-message",
          "Error: transaction could not be removed from storage. The entry has been restored."
        );
        return;
      }

      // Successful deletion â€” clear any previous delete error and update
      // the balance, list, and chart (Req 5.3, 6.4).
      Controller._showValidationMessage("delete-error-message", "");
      Render.renderBalance();
      Controller._renderListWithSort();
      Chart.renderChart();
    });
  },

  // _wireAddCategory()
  //
  // Wires the #add-category button click event (task 10.3). On click:
  //   - Reads the category name from #custom-category-name.
  //   - Calls Validation.validateCategory(name, State.getCategories()).
  //   - On failure: displays the error in #category-validation-message and
  //     returns without mutating state (Req 7.4).
  //   - On success: clears the validation message, adds the category to
  //     State, persists via Storage.saveCategories(), re-renders the
  //     category select via Render.renderCategories(), and clears the input
  //     (Req 7.1, 7.2, 7.3). If saveCategories() returns false, displays a
  //     storage error message per Req 10.5.
  _wireAddCategory() {
    const addBtn = document.getElementById("add-category");
    if (!addBtn) {
      return;
    }

    addBtn.addEventListener("click", function () {
      const nameInput = document.getElementById("custom-category-name");
      const name = nameInput ? nameInput.value : "";

      // Validate using the pure Validation module (Req 7.4).
      const result = Validation.validateCategory(name, State.getCategories());

      if (!result.valid) {
        // Show the descriptive error; do NOT touch state (Req 7.4).
        Controller._showValidationMessage(
          "category-validation-message",
          result.message
        );
        return;
      }

      // Validation passed â€” clear any previous error message.
      Controller._showValidationMessage("category-validation-message", "");

      // Add to in-memory state (Req 7.1). State.addCategory trims internally;
      // we also trim here when passing so the stored name has no leading/
      // trailing whitespace.
      State.addCategory(name.trim());

      // Persist the updated categories array to Local Storage (Req 7.3).
      const saved = Storage.saveCategories();
      if (!saved) {
        // Persist failure: warn the user; the category is already in state
        // so it works for this session even though it won't survive a reload.
        Controller._showValidationMessage(
          "category-validation-message",
          "Warning: category could not be saved to storage."
        );
      }

      // Re-render the category select and visible category list.
      Render.renderCategories();
      Render.renderCategoryList();

      // Clear the custom-category input so the user can add another one
      // without manually deleting the previous value.
      if (nameInput) {
        nameInput.value = "";
      }
    });
  },

  // _wireFormSubmit()
  //
  // Wires the #transaction-form submit event (task 10.2). On submit:
  //   - Reads name, amount, and category from the form inputs.
  //   - Calls Validation.validateTransaction(). On failure, displays the
  //     error message in #validation-message and returns without mutating
  //     state (Req 2.1, 2.2).
  //   - On success: adds the transaction to State, persists, re-renders
  //     balance / list / chart, clears the form, and clears the validation
  //     message (Req 1.2, 1.3, 1.4).
  _wireFormSubmit() {
    const form = document.getElementById("transaction-form");
    if (!form) {
      return;
    }

    form.addEventListener("submit", function (event) {
      // Always prevent the native form submission so the page never reloads.
      event.preventDefault();

      // Read the current values from the three form controls.
      const nameInput     = document.getElementById("transaction-name");
      const amountInput   = document.getElementById("transaction-amount");
      const categoryInput = document.getElementById("transaction-category");

      const name     = nameInput     ? nameInput.value     : "";
      const amount   = amountInput   ? amountInput.value   : "";
      const category = categoryInput ? categoryInput.value : "";

      // Validate the inputs using the pure Validation module (Req 2.1, 2.2).
      const result = Validation.validateTransaction(name, amount, category);

      if (!result.valid) {
        // Display the descriptive error message and do NOT touch state
        // (Req 2.1, 2.2). The form fields are intentionally left populated
        // so the user can correct the offending value without re-typing.
        Controller._showValidationMessage("validation-message", result.message);
        return;
      }

      // Validation passed â€” clear any previous error message (Req 1.4 spirit).
      Controller._showValidationMessage("validation-message", "");

      // Add the transaction to the in-memory state. State.addTransaction
      // generates a unique id and createdAt timestamp internally and appends
      // the new transaction to the transactions array (Req 1.2).
      State.addTransaction(name.trim(), parseFloat(amount), category);

      // Persist the updated transactions array to Local Storage (Req 1.3).
      const saved = Storage.saveTransactions();
      if (!saved) {
        // A failed write should surface an error (Req 10.5). The transaction
        // has already been added to in-memory state, so the UI still shows
        // it; only cross-session persistence is at risk.
        Controller._showValidationMessage(
          "validation-message",
          "Warning: transaction could not be saved to storage."
        );
      }

      // Re-render all affected UI regions so balance, list, and chart
      // reflect the newly added transaction (Req 5.3, 3.1, 6.4).
      Render.renderBalance();
      Controller._renderListWithSort();
      Chart.renderChart();

      // Clear the form fields so the user can enter the next transaction
      // without manually deleting the previous values (Req 1.4).
      if (nameInput)     nameInput.value     = "";
      if (amountInput)   amountInput.value   = "";
      if (categoryInput) categoryInput.value = "";
    });
  },

  // ---- Sort select state ----
  // Tracks the currently active sort option so other operations (e.g. a
  // re-render triggered by deletion) can apply the same sort automatically.
  // "none" means show the canonical State order (newest-first). "amount"
  // and "category" match the Sort module's accepted option strings.
  _currentSortOption: "none",

  // _renderListWithSort()
  //
  // Helper used by every Controller action that must re-render the list.
  // Reads _currentSortOption and calls either:
  //   - Render.renderList(sorted)  â€” when a sort is active ("amount" /
  //     "category"), so the display respects the sort the user chose, even
  //     after an add or delete mutates State.
  //   - Render.renderList()        â€” when no sort is active ("none"), so
  //     the list reverts to State's insertion order (newest first).
  // This single helper keeps all "re-render the list" call sites consistent
  // without duplicating the sort logic.
  _renderListWithSort() {
    const opt = Controller._currentSortOption;
    if (opt === "amount" || opt === "category") {
      const sorted = Sort.sortTransactions(State.getTransactions(), opt);
      Render.renderList(sorted);
    } else {
      Render.renderList();
    }
  },

  // _wireSortSelect()
  //
  // Wires the #sort-select change event (task 10.5). On change:
  //   - Reads the selected value ("amount", "category", or "none").
  //   - Stores the choice in _currentSortOption so subsequent re-renders
  //     (e.g. after a deletion) can preserve the active sort.
  //   - When a sort option is selected ("amount" or "category"): calls
  //     Sort.sortTransactions(State.getTransactions(), option) to get a
  //     sorted copy and passes it to Render.renderList(sorted). The Sort
  //     module never mutates State; the sorted array is display-only
  //     (Req 8.3).
  //   - When "none" is selected: calls Render.renderList() with no argument
  //     so it falls back to State.getTransactions() in reverse insertion
  //     order (newest first, Req 3.1).
  //   - Only re-renders the list, not the balance or chart â€” sorting does
  //     not change the underlying data (Req 8.2, 8.5).
  _wireSortSelect() {
    const sortSelect = document.getElementById("sort-select");
    if (!sortSelect) {
      return;
    }

    sortSelect.addEventListener("change", function () {
      const option = sortSelect.value; // "none", "amount", or "category"
      Controller._currentSortOption = option;

      if (option === "amount" || option === "name") {
        // Produce a sorted copy â€” State is never mutated (Req 8.3).
        const sorted = Sort.sortTransactions(State.getTransactions(), option);
        Render.renderList(sorted);
      } else {
        // "none": restore the original insertion order (newest first).
        Render.renderList();
      }
    });
  },

  // _wireThemeToggle()
  //
  // Wires the #theme-toggle button click event (task 10.6). On click:
  //   - Calls Theme.toggleTheme() which flips the current theme, updates
  //     State, sets the data-theme attribute on <html>, and persists (Req
  //     9.1, 9.2, 9.3).
  //   - Updates the aria-pressed attribute on the button to reflect the new
  //     theme state ("true" when dark, "false" when light) for accessibility.
  //   - If the toggle / persist fails (returns false), shows a storage error
  //     message via the validation message area (Req 10.5).
  _wireThemeToggle() {
    const toggleBtn = document.getElementById("theme-toggle");
    if (!toggleBtn) {
      return;
    }

    toggleBtn.addEventListener("click", function () {
      const saved = Theme.toggleTheme();

      // Reflect the new theme in aria-pressed so screen readers know the
      // current state ("true" = dark theme is active).
      const isDark = State.getTheme() === "dark";
      toggleBtn.setAttribute("aria-pressed", isDark ? "true" : "false");

      if (!saved) {
        // The theme switched in-memory and on screen but could not be
        // persisted â€” warn the user (Req 10.5).
        Controller._showValidationMessage(
          "validation-message",
          "Warning: theme preference could not be saved to storage."
        );
      }
    });
  },

  // _wireDeleteCategory()
  // Wires category deletion via event delegation on #category-list.
  _wireDeleteCategory() {
    const listEl = document.getElementById("category-list");
    if (!listEl) {
      return;
    }
    listEl.addEventListener("click", function (event) {
      let btn = event.target;
      while (btn && btn !== listEl) {
        if (btn.nodeName === "BUTTON" && btn.classList.contains("delete-category")) {
          break;
        }
        btn = btn.parentElement;
      }
      if (!btn || !btn.classList.contains("delete-category")) {
        return;
      }
      const categoryName = btn.getAttribute("data-category");
      if (!categoryName) {
        return;
      }
      const removed = State.deleteCategory(categoryName);
      if (!removed) {
        Controller._showValidationMessage(
          "category-validation-message",
          "Kategori tidak dapat dihapus (minimal satu kategori harus ada)."
        );
        return;
      }
      Controller._showValidationMessage("category-validation-message", "");
      const saved = Storage.saveCategories();
      if (!saved) {
        Controller._showValidationMessage(
          "category-validation-message",
          "Peringatan: perubahan tidak dapat disimpan ke storage."
        );
      }
      Render.renderCategories();
      Render.renderCategoryList();
    });
  },
};

// ===== Bootstrap =====
// Start the application once the DOM is fully parsed. All modules are
// defined above as plain objects, so there are no import/export concerns.
document.addEventListener("DOMContentLoaded", function () {
  Controller.init();
});
