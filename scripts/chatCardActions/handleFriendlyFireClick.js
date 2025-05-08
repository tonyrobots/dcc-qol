/* global ui, Roll, ChatMessage, game */
/**
 * Handles the click event for the "Friendly Fire Check" button on the QoL attack card.
 *
 * @param {Event} event - The click event.
 * @param {ChatMessage} message - The chat message document associated with the card.
 * @param {Actor} actor - The actor performing the action (the one who might have friendly fired).
 * @param {object} qolFlags - The dccqol flags from the message.
 */
export async function handleFriendlyFireClick(event, message, actor, qolFlags) {
    event.preventDefault();
    // console.log("DCC-QOL | Friendly Fire button clicked via handleFriendlyFireClick", { actor, qolFlags });

    if (!actor) {
        console.error(
            "DCC-QOL | Actor not available for friendly fire check. Message ID:",
            message.id
        );
        ui.notifications.error(
            "DCC QoL: Actor context not found for friendly fire check."
        );
        return;
    }

    try {
        const roll = new Roll("1d100");
        await roll.evaluate({ async: true });

        let resultText;
        let resultClass;
        if (roll.total > 50) {
            // > 50 is success (missed ally)
            resultText = game.i18n.localize("DCC-QOL.FriendlyFireSuccess");
            resultClass = "status-success";
        } else {
            // <= 50 is fail (hit ally)
            resultText = game.i18n.localize("DCC-QOL.FriendlyFireFail");
            resultClass = "status-failure";
        }

        const rollHTML = await roll.render();
        const finalContent = `${rollHTML}<div class="dccqol-friendlyfire-result ${resultClass}">${resultText}</div>`;

        roll.toMessage({
            speaker: ChatMessage.getSpeaker({ actor: actor }),
            flavor: game.i18n.localize("DCC-QOL.FriendlyFireCheck"),
            content: finalContent,
            flags: {
                "dccqol.isFriendlyFireCheck": true,
                "dccqol.parentId": message.id,
                "dccqol.actorId": actor.id,
            },
        });
    } catch (rollError) {
        console.error(
            "DCC-QOL | Error performing friendly fire roll:",
            rollError
        );
        ui.notifications.error(
            `DCC QoL: Error performing friendly fire roll - ${rollError.message}`
        );
    }
}
