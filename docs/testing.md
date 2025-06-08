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

## Running Tests

Tests can be run from the command line using the following npm script:

```bash
npm test
```

This will execute all files in the `scripts/__tests__/` directory that end with `.test.js`.
