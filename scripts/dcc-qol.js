/* global canvas, game, Hooks, libWrapper, loadTemplates, ui */
import { registerSettings } from "./settings.js";
import DCCQOL from "./patch.js";
import * as chat from "./chat.js";
import { registerHooks } from "./hooks.js";
import { registerWebsocketListeners } from "./socket.js";
import { registerDevModeTools } from "./utils.js";

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
    // libWrapper.register(
    //     "dcc-qol",
    //     "game.dcc.DCCActor.prototype.rollWeaponAttack",
    //     rollPatchedWeaponAttack,
    //     "MIXED"
    // );
}

async function loadTemplate(data) {
    return await renderTemplate(
        "modules/dcc-qol/templates/attackroll-card.html",
        data
        // {
        // actor: actor,
        // weapon: weapon,
        // tokenId: tokenD.id,
        // target: target,
        // targettokenId: targetTokenId,
        // options: options,
        // diceHTML: diceHTML,
        // deedDieHTML: deedDieHTML,
        // isFumble: isFumble,
        // hitsTarget: hitsTarget,
        // isDisplayHitMiss: isDisplayHitMiss,
        // isCrit: isCrit,
        // hitsAc: hitsAc,
        // headerText: headerText,
        // }
    );
}

Hooks.once("init", async function () {
    console.log("DCC-QOL | Initializing DCC Quality of Life Improvements");

    // Check for required modules
    if (!game.modules.get("lib-wrapper")?.active) {
        console.warn(
            "DCC-QOL | libWrapper is NOT active; some features may not work!"
        );
    }
    if (!game.modules.get("socketlib")?.active) {
        console.warn(
            "DCC-QOL | socketlib is NOT active; some features may not work!"
        );
        return;
    }

    // Register module hooks
    registerHooks();

    // Register settings
    registerSettings();

    // Preload templates and initialize
    await preloadTemplates();
    initPatching();

    // Add chat listeners
    Hooks.on("renderChatLog", (app, html, data) => chat.addChatListeners(html));

    // Handle chat message creation
    Hooks.on("createChatMessage", async (chatMessage, options, userId) => {
        if (chatMessage.flags.dcc?.isToHit) {
            const actor = game.actors.get(chatMessage.speaker.actor);
            const tokenD = tokenForActorId(actor._id);

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

            const weapon = actor.items.get(chatMessage.system.weaponId);
            const target = game.user.targets.first()
                ? game.user.targets.first().actor.name
                : null;
            const targetTokenId = game.user.targets.first()
                ? game.user.targets.first().document.uuid
                : null;

            const data = {
                actor: actor,
                weapon: weapon,
                tokenId: tokenD.id,
                target: target,
                targettokenId: targetTokenId,
            };

            const content = await loadTemplate(data);

            await ChatMessage.updateDocuments([
                {
                    _id: chatMessage.id,
                    content: content,
                    "system.attackRollHTML": content,
                },
            ]);
        }
    });
});

Hooks.once("socketlib.ready", async function () {
    // Register socketlib listeners
    registerWebsocketListeners();
});

Hooks.once("ready", async function () {
    if (!game.modules.get("lib-wrapper")?.active && game.user.isGM) {
        console.warn("DCC-QOL | libWrapper is NOT active; exiting!");
        ui.notifications.warn(game.i18n.localize("DCC-QOL.libwrapperWarning"));
    }
    if (!game.modules.get("socketlib")?.active && game.user.isGM) {
        console.warn("DCC-QOL | socketlib is NOT active; exiting!");
        ui.notifications.warn(game.i18n.localize("DCC-QOL.socketlibWarning"));
    }

    // Register dev mode tools if available
    registerDevModeTools();
});

// testing dcc attack hook
// Hooks.on("preCreateChatMessage", (data, options, userId) => {
