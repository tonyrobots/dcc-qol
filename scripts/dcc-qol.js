/* global canvas, game, Hooks, libWrapper, loadTemplates, ui */
import { registerSystemSettings } from "./settings.js";
import DCCQOL from "./patch.js";
import * as chat from "./chat.js";
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
    const allTokens = actor.getActiveTokens();
    if (allTokens.length === 1) return allTokens[0].document;
    else {
        const controlled = canvas?.tokens?.controlled;
        const filteredTokens = allTokens.filter((value) =>
            controlled.includes(value)
        );
        if (filteredTokens.length === 1) return filteredTokens[0].document;
        else {
            return undefined;
        }
    }
}

function rollPatchedWeaponAttack(wrapped, ...args) {
    const actor = new DCCQOL(this);
    const tokenD = tokenForActorId(this._id);
    // if settings are set to checkWeaponRange, or automateFriendlyFire, require a token to be in scene; otherwise, proceed without one
    if (
        game.settings.get("dcc-qol", "checkWeaponRange") ||
        game.settings.get("dcc-qol", "automateFriendlyFire")
    ) {
        if (!tokenD) {
            return ui.notifications.warn(
                game.i18n.localize("DCC-QOL.ControlAToken")
            );
        }
    }
    actor.rollWeaponAttackQOL(args[0], args[1], tokenD);
}

function initPatching() {
    libWrapper.register(
        "dcc-qol",
        "game.dcc.DCCActor.prototype.rollWeaponAttack",
        rollPatchedWeaponAttack,
        "MIXED"
    );
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
    initPatching();
    Hooks.on("renderChatLog", (app, html, data) => chat.addChatListeners(html));
});

Hooks.once("setup", async function () {
    // Do anything after initialization but before ready
    chat.setupSocket();
});

Hooks.once("ready", async function () {
    if (!game.modules.get("lib-wrapper")?.active && game.user.isGM) {
        console.warn("DCC-QOL | libWrapper is NOT active exiting!");
        ui.notifications.warn(game.i18n.localize("DCC-QOL.libwrapperWarning"));
    }
    if (!game.modules.get("socketlib")?.active && game.user.isGM) {
        console.warn("DCC-QOL | socketlib is NOT active exiting!");
        ui.notifications.warn(game.i18n.localize("DCC-QOL.socketlibWarning"));
    }
});
