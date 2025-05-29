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
import { checkAndCorrectEmoteRollsSetting } from "./compatibility.js";
import {
    gmApplyDamage,
    createDamageScrollingText,
    gmUpdateMessageFlag,
} from "./socketHandlers.js";

// Declare socket variable in module scope
export let socket;

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
    console.log(
        "DCC QoL | Initializing DCC Quality of Life Improvements module"
    );
    if (!game.modules.get("socketlib")?.active) {
        console.warn("DCC-QOL | socketlib is NOT active; exiting!");
        return;
    }
    // CONFIG.debug.hooks = true;

    registerSettings();
    preloadTemplates();
    registerHookListeners();
});

// Socketlib setup
Hooks.once("socketlib.ready", () => {
    // Ensure socketlib is available
    if (typeof socketlib === "undefined") {
        console.error(
            "DCC QoL | socketlib is not defined when socketlib.ready hook fires!"
        );
        return;
    }
    socket = socketlib.registerModule("dcc-qol");
    if (!socket) {
        console.error(
            "DCC QoL | Failed to register module with socketlib or received null socket."
        );
        return;
    }
    socket.register("gmApplyDamage", gmApplyDamage);
    socket.register("createDamageScrollingText", createDamageScrollingText);
    socket.register("gmUpdateMessageFlag", gmUpdateMessageFlag);
    console.log("DCC QoL | Socketlib initialized and functions registered.");
});

Hooks.once("ready", async () => {
    // Any other ready-time setup

    // Delay the compatibility check slightly to ensure DCC system settings are fully available
    setTimeout(async () => {
        await checkAndCorrectEmoteRollsSetting();
        console.log(
            "DCC QoL | Module ready and compatibility checks performed."
        );
    }, 2000);
});
