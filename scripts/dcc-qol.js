/**
 * Main entry point for the DCC Quality of Life Improvements module.
 *
 * Responsibilities:
 * - Preload Handlebars templates.
 * - Initialize module settings.
 * - Register hook listeners.
 */

import { registerSettings } from "./settings.js";
import { registerHookListeners } from "./hooks/listeners.js";

/**
 * Preloads Handlebars templates for the module.
 * @returns {Promise<Handlebars.TemplateDelegate[]>} A Promise that resolves when all templates are loaded.
 */
async function preloadTemplates() {
    const templatePaths = [
        "modules/dcc-qol/templates/attackroll-card.html",
        "modules/dcc-qol/templates/qol-buttons.hbs",
        // Add other template paths here if needed
    ];
    return loadTemplates(templatePaths);
}

// Initialize the module
Hooks.once("init", () => {
    console.log("DCC QoL | Initializing DCC Quality of Life Improvements");

    registerSettings();
    preloadTemplates();

    // Any other init-time setup
});

// Setup hook listeners
Hooks.once("ready", () => {
    registerHookListeners();
    // Any other ready-time setup
});
