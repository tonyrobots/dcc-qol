// Hook handlers for DCC-QOL module
import { registerSettings } from "./settings.js";
import { DCCQOLCombat } from "./combat.js";
import { DCCQOLChat } from "./chatHandlers.js";

export function registerHooks() {
    // Initialize hooks
    Hooks.once("init", async function () {
        console.log("DCC-QOL | Initializing DCC-QOL");
        await registerSettings();
    });

    // Combat and roll related hooks
    Hooks.on("preUpdateActor", DCCQOLCombat.onPreUpdateActor);

    // Chat message hooks
    Hooks.on(
        "createChatMessage",
        DCCQOLChat.onCreateChatMessage.bind(DCCQOLChat)
    );
    Hooks.on(
        "renderChatMessage",
        DCCQOLChat.onRenderChatMessage.bind(DCCQOLChat)
    );

    // Register libWrapper overrides and sockets after system is ready
    Hooks.once("ready", () => {
        // Register libWrapper overrides
        if (!game.modules.get("lib-wrapper")?.active) {
            console.warn(
                "DCC-QOL | libWrapper is NOT active; skipping method wrapping"
            );
            return;
        }

        // Ensure DCC system exists and is initialized
        if (!game.system.id === "dcc") {
            console.error("DCC-QOL | DCC system not found");
            return;
        }

        // Wait a moment to ensure DCC system is fully initialized
        setTimeout(() => {
            try {
                // Get the DCC Actor class
                const DCCActor = CONFIG.Actor.documentClass;
                if (!DCCActor) {
                    throw new Error("DCC Actor class not found");
                }

                // Register weapon attack wrapper
                if (typeof DCCActor.prototype.rollWeaponAttack === "function") {
                    libWrapper.register(
                        "dcc-qol",
                        "CONFIG.Actor.documentClass.prototype.rollWeaponAttack",
                        DCCQOLCombat.onWeaponAttack,
                        "WRAPPER"
                    );
                    console.log("DCC-QOL | Registered weapon attack wrapper");
                }

                // Register damage roll wrapper
                if (typeof DCCActor.prototype.rollDamage === "function") {
                    libWrapper.register(
                        "dcc-qol",
                        "CONFIG.Actor.documentClass.prototype.rollDamage",
                        DCCQOLCombat.onRollDamage,
                        "WRAPPER"
                    );
                    console.log("DCC-QOL | Registered damage roll wrapper");
                }

                // Register critical roll wrapper
                if (typeof DCCActor.prototype.rollCritical === "function") {
                    libWrapper.register(
                        "dcc-qol",
                        "CONFIG.Actor.documentClass.prototype.rollCritical",
                        DCCQOLCombat.onRollCritical,
                        "WRAPPER"
                    );
                    console.log("DCC-QOL | Registered critical roll wrapper");
                }

                console.log(
                    "DCC-QOL | Successfully registered all method wrappers"
                );
            } catch (error) {
                console.error(
                    "DCC-QOL | Error registering method wrappers:",
                    error
                );
            }
        }, 100); // Small delay to ensure system is ready

        // Register socket for damage application
        if (!game.modules.get("socketlib")?.active) {
            console.warn(
                "DCC-QOL | socketlib is NOT active; skipping socket registration"
            );
        } else {
            try {
                const socket = socketlib.registerModule("dcc-qol");
                socket.register("applyDamage", DCCQOLCombat.applyDamage);
                console.log("DCC-QOL | Successfully registered socket");
            } catch (error) {
                console.error("DCC-QOL | Error registering socket:", error);
            }
        }
    });
}
