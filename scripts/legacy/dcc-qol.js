/* global canvas, game, Hooks, libWrapper, loadTemplates, ui */
import { registerSystemSettings } from "./settings.js";
import DCCQOL from "./patch.js";
import * as chat from "./chat.js";
import { initializeHookListeners } from "./hooks/listeners.js";
export async function preloadTemplates() {
    const templatePaths = ["modules/dcc-qol/templates/attackroll-card.html"];
    return loadTemplates(templatePaths);
}
// function tokenForActorId (tokenUuid) {
//   const position = tokenUuid.indexOf('.Actor.')
//   if (position === -1) { return undefined } else { return fromUuidSync(tokenUuid.substr(0, position)) }
// }

function tokenForActorId(actorId) {
    const actor = game.actors.get(actorId);
    if (!actor) return undefined;
    const allTokens = actor.getActiveTokens();
    if (!allTokens) return undefined;

    if (allTokens.length === 1) return allTokens[0].document;
    else {
        const controlled = canvas?.tokens?.controlled;
        if (
            !controlled ||
            !Array.isArray(controlled) ||
            controlled.length === 0
        ) {
            return undefined;
        }

        const filteredTokens = allTokens.filter((value) =>
            controlled.includes(value)
        );
        if (filteredTokens.length === 1) return filteredTokens[0].document;
        else {
            return undefined;
        }
    }
}

Hooks.once("init", async function () {
    console.log("DCC-QOL | Initializing DCC-QOL.");
    if (!game.modules.get("lib-wrapper")?.active) {
        console.warn("DCC-QOL | libWrapper is NOT active; exiting!");
    }
    if (!game.modules.get("socketlib")?.active) {
        console.warn("DCC-QOL | socketlib is NOT active; exiting!");
        return;
    }
    await registerSystemSettings();
    preloadTemplates();
    Hooks.on("renderChatLog", (app, html, data) => chat.addChatListeners(html));

    initializeHookListeners();
});

Hooks.once("setup", async function () {
    // Do anything after initialization but before ready
    if (game.modules.get("socketlib")?.active) {
        chat.setupSocket();
    } else {
        console.warn(
            "DCC-QOL | Cannot setup socket because socketlib is not active."
        );
    }
});

Hooks.once("ready", async function () {
    if (!game.modules.get("lib-wrapper")?.active && game.user.isGM) {
        console.warn("DCC-QOL | libWrapper is NOT active; exiting!");
        ui?.notifications?.warn(
            game.i18n.localize("DCC-QOL.libwrapperWarning")
        );
    }
    if (!game.modules.get("socketlib")?.active && game.user.isGM) {
        console.warn("DCC-QOL | socketlib is NOT active; exiting!");
        ui?.notifications?.warn(game.i18n.localize("DCC-QOL.socketlibWarning"));
    }
});
