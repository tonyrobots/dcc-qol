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

    Hooks.on("createChatMessage", async (chatMessage, options, userId) => {
        if (chatMessage.flags.dcc?.isToHit) {
            // Modify the chat message as needed
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
            // Perform additional modifications to the chat message here
            // Prepare data for the template
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
                // options: chatMessage.system.flags.dcc.roll.options,
                // diceHTML: chatMessage.system.flags.dcc.roll.diceHTML,
                // deedDieHTML: chatMessage.system.flags.dcc.roll.deedDieHTML,
                // isFumble: chatMessage.system.flags.dcc.roll.isFumble,
                // hitsTarget: chatMessage.system.flags.dcc.roll.hitsTarget,
                // isDisplayHitMiss:
                //     chatMessage.system.flags.dcc.roll.isDisplayHitMiss,
                // isCrit: chatMessage.system.flags.dcc.roll.isCrit,
                // hitsAc: chatMessage.system.flags.dcc.roll.hitsAc,
                // headerText: chatMessage.system.flags.dcc.roll.headerText,
            };

            // Render the template
            const content = await loadTemplate(data);
            console.log("Chat content:" + content);
            console.log(chatMessage);

            // Update the chat message content
            // chatMessage.update({ content: content });
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

Hooks.once("setup", async function () {
    // Do anything after initialization but before ready
    chat.setupSocket();
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
});

// testing dcc attack hook
// Hooks.on("preCreateChatMessage", (data, options, userId) => {
