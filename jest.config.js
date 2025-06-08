/** @type {import('jest').Config} */
const config = {
    // The environment in which the tests should be run
    testEnvironment: "jest-environment-jsdom",

    // A list of paths to directories that Jest should use to search for files in
    roots: ["<rootDir>/scripts"],

    // A list of paths to modules that run some code to configure or set up the testing framework before each test
    setupFilesAfterEnv: ["<rootDir>/scripts/__mocks__/foundry.js"],

    // The pattern Jest uses to detect test files
    testMatch: ["**/__tests__/**/*.test.js"],

    // A map from regular expressions to module names or to arrays of module names that allow to stub out resources with a single module
    moduleNameMapper: {
        // In the DCC system, all module paths are relative to the root of the DCC system folder
        // We need to tell Jest how to resolve these paths.
        // This regex will match any import that starts with `module/` and rewrite it to point to our root directory
        "^module/(.*)$": "<rootDir>/$1",
        // Mock CSS and other file imports
        "\\.(css|less|scss|sass)$": "identity-obj-proxy",
    },

    // Indicates whether each individual test should be reported during the run
    verbose: true,
};

module.exports = config;
