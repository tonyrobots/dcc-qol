# Automated Testing

This document outlines the setup and practices for automated testing in the `dcc-qol` module.

## Tooling

-   **Test Runner:** [Jest](https://jestjs.io/)
-   **Environment:** [JSDOM](https://github.com/jsdom/jsdom) is used to simulate a browser environment for tests.
-   **Compiler:** [Babel](https://babeljs.io/) is used to transpile modern JavaScript (ESM) for Jest.

## Project Structure

-   **Test Files:** All test files are located in the `scripts/__tests__/` directory. Test files should have the suffix `.test.js` (e.g., `utils.test.js`).
-   **Mocks:** Mock implementations of Foundry VTT and DCC system objects are located in the `scripts/__mocks__/` directory. These are essential for testing module code in isolation without needing to run the full Foundry application.

## Mocking Strategy

To test code that depends on the Foundry VTT API, we use a global mock setup.

-   **Global Mocks:** The `scripts/__mocks__/foundry.js` file contains mock implementations for global objects like `game`, `Hooks`, `Actor`, `Item`, etc.
-   **Automatic Loading:** This global mock file is automatically loaded before any test suite is run, configured via the `setupFilesAfterEnv` option in `jest.config.js`. This means that objects like `game` are available in all test files without needing to be manually imported or mocked.
-   **Extending Mocks:** If a test requires a part of the Foundry API that is not yet mocked in `foundry.js` (e.g., `game.someNewApi`), it should be added to the `foundry.js` file to make it available for all future tests. Avoid mocking globals directly within individual test files.

### Mock Data Factory

The `scripts/__mocks__/mock-data.js` file provides factory functions for creating standardized test data:

```javascript
import {
    createMockPc,
    createMockNpc,
    mockMeleeWeapon,
    mockRangedWeapon,
} from "../__mocks__/mock-data.js";

// Create a fully-equipped PC for testing
const testActor = createMockPc();

// Create an NPC with custom data
const testNPC = createMockNpc({ name: "Custom Orc" });

// Use predefined weapons
const weaponId = mockMeleeWeapon._id;
```

This approach provides:

-   **Consistency:** All tests use the same standardized data
-   **Reusability:** No need to recreate complex mock objects in each test
-   **Maintainability:** Changes to mock data structure only need to be made in one place

## Test Organization

Tests should be organized in nested `describe` blocks that mirror the feature hierarchy:

```javascript
describe("Chat Message Hooks", () => {
    describe("QoL Attack Roll Card", () => {
        describe("Roll Damage", () => {
            it('should display a "Roll Damage" button on a successful hit', () => {
                // Test implementation
            });

            it("should roll the correct damage formula when clicked", () => {
                // Test implementation
            });
        });

        describe("Roll Crit", () => {
            // Future crit tests
        });
    });
});
```

### Common Setup with beforeEach

Use `beforeEach` hooks to eliminate repetitive setup code:

```javascript
describe("Feature Tests", () => {
    let mockActor, mockMessage, html;

    beforeEach(async () => {
        // Common setup for all tests in this group
        mockActor = createMockPc();
        // ... additional setup
    });

    it("should do something", () => {
        // Test can use mockActor, mockMessage, html directly
    });
});
```

## jQuery Event Testing

When testing jQuery event handlers, use jQuery's `.trigger()` method instead of native DOM events:

```javascript
// ✅ Correct - triggers jQuery event handlers
$(button).trigger("click");

// ❌ Incorrect - may not trigger jQuery handlers
button.click();
```

For async operations, add a small delay to allow processing to complete:

```javascript
$(button).trigger("click");
await new Promise((resolve) => setTimeout(resolve, 0));
```

## Module Mocking

When testing functions that import from other modules (like socket handlers), use `jest.mock()`:

```javascript
// Mock the dcc-qol module to provide a mock socket
jest.mock("../dcc-qol.js", () => ({
    socket: {
        executeAsGM: jest.fn(),
    },
}));
```

## Running Tests

Tests can be run from the command line using the following npm script:

```bash
npm test
```

This will execute all files in the `scripts/__tests__/` directory that end with `.test.js`.

## Testing Philosophy: True Tests, Not Shallow Mocks

**Our tests must validate real functionality, not trivial mock implementations.**

### The Testing Pyramid Applied

We follow a **hybrid approach** based on the testing pyramid:

1. **Unit Tests (Many)**: Test isolated logic, data preparation, and utility functions
2. **Integration Tests (Some)**: Test interactions between our code and external dependencies using realistic fixtures
3. **End-to-End Tests (Few)**: Test complete user workflows

### What We DO Test (Core Functionality)

-   ✅ **Data extraction and preparation** from message flags and actor data
-   ✅ **Template contracts** - verify `renderTemplate` is called with correct paths and data
-   ✅ **DOM manipulation logic** - test actual HTML changes using realistic fixtures
-   ✅ **Event listener attachment** - verify click handlers are properly bound
-   ✅ **Conditional behavior** - test edge cases and setting-dependent logic
-   ✅ **Business logic** - dice modifications, luck calculations, range checks

### What We DON'T Test (External Dependencies)

-   ❌ **Foundry's template compilation** - that's Foundry's responsibility
-   ❌ **jQuery/DOM API implementations** - those are third-party libraries
-   ❌ **Mock implementations that always pass** - these provide false confidence

### Realistic Fixtures Over Shallow Mocks

Instead of mocking `renderTemplate` to return simple strings, we:

```javascript
// ❌ BAD: Shallow mock that doesn't test real integration
renderTemplate.mockResolvedValue("<button>Click me</button>");

// ✅ GOOD: Realistic fixture based on actual template output
const fixtureHTML = `
    <div class="dccqol chat-card">
        <div class="roll-result status-success">Attack hits target!</div>
        <button data-action="damage">Roll Damage (1d8)</button>
    </div>
`;
renderTemplate.mockResolvedValue(fixtureHTML);
```

This approach ensures we test:

-   Real HTML structure that templates would produce
-   Actual CSS selectors and DOM queries
-   Event binding to realistic elements
-   Integration between template data and rendered output

### Contract Testing

We verify the **contracts** between our code and external systems:

```javascript
// Test that we call renderTemplate with the right parameters
expect(renderTemplate).toHaveBeenCalledWith(
    "modules/dcc-qol/templates/attackroll-card.html",
    expect.objectContaining({
        hitsTarget: true,
        weapon: expect.objectContaining({ name: "Sword" }),
        // ... other expected data
    })
);
```

## Best Practices

1. **Start Simple:** Begin with basic unit tests for utility functions before moving to complex integration tests.
2. **Test Behavior, Not Implementation:** Focus on what the code does, not how it does it.
3. **Use Descriptive Test Names:** Test names should clearly describe the expected behavior.
4. **Group Related Tests:** Use nested `describe` blocks to organize tests by feature or component.
5. **Share Setup Code:** Use `beforeEach` hooks to eliminate repetitive test setup.
6. **Mock Thoughtfully:** Mock external dependencies, but use realistic fixtures that represent actual data structures and HTML output.
7. **Verify Contracts:** Test that your code calls external APIs with the correct parameters.
8. **Test Edge Cases:** Include tests for error conditions, missing data, and disabled settings.
9. **Avoid Trivial Tests:** Don't write tests that can only pass or fail based on your mock implementations.

## Audit Step

After implementing tests, perform an audit of the tests: For each test, provide a summary of exactly what it is testing, and an evaluation of whether it meets our testing criteria, as outlined in this document; in particular, is this a true & useful test that will fail if something in our code breaks, or a test that will trivially pass because it's not meaningfully engaging with real application code.
