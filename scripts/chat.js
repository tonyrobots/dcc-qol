/* global canvas, game, fromUuidSync, Roll, socketlib */

import DCCQOL from "./patch.js";

export let socketlibSocket;

async function applyDamageQOL(targettoken, damage) {
    let targetActor;
    if (targettoken) {
        game.user.updateTokenTargets([targettoken._id]);
        targetActor = game.canvas.tokens.get(targettoken._id).actor;
    } else {
        targetActor = game.user.targets.first().actor;
    }

    await targetActor.update({
        "system.attributes.hp.value":
            targetActor.system.attributes.hp.value - damage,
    });
}

export const setupSocket = () => {
    socketlibSocket = socketlib.registerModule("dcc-qol");
    socketlibSocket.register("applyDamageQOL", applyDamageQOL);
};

export function addChatListeners(html) {
    html.on("click", ".card-buttons button", ChatCardAction);
    html.on("click", ".card-header", ChatCardToggleContent);
}

async function ChatCardToggleContent(event) {
    event.preventDefault();
    const header = event.currentTarget;
    const card = header.closest(".chat-card");
    const content = card.querySelector(".card-content");
    content.style.display = content.style.display === "none" ? "block" : "none";
}

async function ChatCardAction(event) {
    const button = event.currentTarget;
    button.disabled = true;
    const card = button.closest(".chat-card");
    const messageId = card.closest(".message").dataset.messageId;
    const message = game.messages.get(messageId);
    const action = button.dataset.action;
    button.disabled = false;
    // const actor = game.actors.get(card.dataset.actorId) || null;

    // Use the token actor, not the base actor
    const tokenUuid = card.dataset.tokenId;
    // console.log("Token UUID:", tokenUuid);

    let token;
    try {
        token = await fromUuid(tokenUuid);
    } catch (error) {
        console.error(`Error resolving UUID ${tokenUuid}:`, error);
    }

    if (!token) {
        console.warn(`Token with ID ${tokenUuid} not found on the canvas.`);
    }
    const actor = token ? token.actor : null;
    if (!actor) {
        console.warn(`Actor for token ID ${tokenUuid} not found.`);
    }

    // const messagecreator = message._source.user;
    // console.warn("message", message);
    const messagecreator = message._source.author;

    if (game.user._id !== messagecreator && !game.user.isGM) return;

    if (!actor) {
        console.error("No actor found for card!", card);
        return;
    }
    // Why are these two additional actor objects created? In console they look identical to the actor object. Tested, they are not identical, don't yet know difference.
    const act = new game.dcc.DCCActor(actor);
    const DCCQOLactor = new DCCQOL(actor);

    // output to console for debugging the following: actor, act, DCCQOLactor, action, card
    // console.log("actor", actor);
    // console.log("act", act);
    // console.log("DCCQOLactor", DCCQOLactor);

    // console.log("action", action);
    // console.log("card", card);

    const options = JSON.parse(card.dataset.options);
    const weapon = actor.items.get(card.dataset.weaponId);

    const targettokenId = card.dataset.targettokenId;
    const targettoken = fromUuidSync(targettokenId);

    const controlledTokens = canvas.tokens.controlled;
    let cToken;

    switch (action) {
        case "damage":
            console.log("weapon:", weapon);
            const damageRollResult = await act.rollDamage(weapon, options);
            let targetActor;

            if (damageRollResult.damage < 1) {
                damageRollResult.damage = 1;
                damageRollResult.roll._total = 1;
            }

            let diceHTML = await damageRollResult.roll.render();

            if (targettoken || Array.from(game.user.targets).length === 1) {
                if (targettoken) {
                    game.user.updateTokenTargets([targettoken._id]);
                    targetActor = targettoken.actor;
                } else {
                    targetActor = game.user.targets.first().actor;
                }

                // show different messages depending on automateDamageApply setting
                if (game.settings.get("dcc-qol", "automateDamageApply")) {
                    diceHTML =
                        diceHTML +
                        "<br/>" +
                        game.i18n.format("DCC-QOL.TakeDamage", {
                            actor: targetActor.name,
                            damage: damageRollResult.damage,
                        });
                } else {
                    diceHTML =
                        diceHTML +
                        game.i18n.format("DCC-QOL.TakeDamageManual", {
                            actor: targetActor.name,
                            damage: damageRollResult.damage,
                        });
                }

                const msg = await damageRollResult.roll.toMessage({
                    user: game.user.id,
                    speaker: {
                        alias: actor.name,
                    },
                    content: diceHTML,
                    flavor: game.i18n.format("DCC-QOL.DamageRoll", {
                        weapon: weapon.name,
                    }),
                    flags: {
                        "dcc.RollType": "Damage",
                        "dcc.ItemId": options.weaponId,
                    },
                });

                if (game.settings.get("dcc-qol", "automateDamageApply")) {
                    /* Update HP only after Dice So Nice animation finished */
                    if (game.modules.get("dice-so-nice")?.active) {
                        game.dice3d
                            .waitFor3DAnimationByMessageID(msg.id)
                            .then(() =>
                                socketlibSocket.executeAsGM(
                                    "applyDamageQOL",
                                    targettoken,
                                    damageRollResult.damage
                                )
                            );
                    } else {
                        await socketlibSocket.executeAsGM(
                            "applyDamageQOL",
                            targettoken,
                            damageRollResult.damage
                        );
                    }
                }
            } else {
                await damageRollResult.roll.toMessage({
                    user: game.user.id,
                    speaker: {
                        alias: actor.name,
                    },
                    content: diceHTML,
                    flavor: game.i18n.format("DCC-QOL.DamageRoll", {
                        weapon: weapon.name,
                    }),
                    flags: {
                        "dcc.RollType": "Damage",
                        "dcc.ItemId": options.weaponId,
                    },
                });
            }

            break;
        case "fumble":
            cToken = canvas.tokens.get(fromUuidSync(card.dataset.tokenId)._id);
            cToken.control({ releaseOthers: true });
            await act.rollFumble(options);
            canvas.tokens.selectObjects();
            for (const token of controlledTokens) {
                cToken = canvas.tokens.get(token.id);
                cToken.control({ releaseOthers: false });
            }
            break;
        case "crit":
            cToken = canvas.tokens.get(fromUuidSync(card.dataset.tokenId)._id);
            cToken.control({ releaseOthers: true });
            await DCCQOLactor.rollCriticalQOL(options, targettoken, actor);
            canvas.tokens.selectObjects();
            for (const token of controlledTokens) {
                cToken = canvas.tokens.get(token.id);
                cToken.control({ releaseOthers: false });
            }
            break;
        case "friendlyFire":
            const roll = new Roll("d100");
            await roll.evaluate({
                async: true,
            });

            const friendlyFire = await roll.render();
            let friendlyFireHTML;

            if (roll._total >= 51) {
                const chatText = game.i18n.format(
                    "DCC-QOL.FriendlyFireSuccess",
                    {
                        weapon: weapon.name,
                    }
                );
                friendlyFireHTML =
                    friendlyFire.replace("dice-total", "dice-total success") +
                    `<div class="dccqol chat-card"><div class="chat-details"><div class="ff-result">${chatText}</div></div></div>`;
            } else {
                const chatText = game.i18n.format("DCC-QOL.FriendlyFireFail", {
                    weapon: weapon.name,
                });
                friendlyFireHTML =
                    friendlyFire.replace("dice-total", "dice-total fail") +
                    `<div class="dccqol chat-card"><div class="chat-details"><div class="ff-result">${chatText}</div></div></div>`;
            }

            roll.toMessage({
                user: game.user.id,
                speaker: {
                    alias: actor.name,
                },
                flavor: game.i18n.localize("DCC-QOL.FriendlyFireCheck"),
                content: friendlyFireHTML,
                rollMode: game.settings.get("core", "rollMode"),
            });
            break;
    }
}
