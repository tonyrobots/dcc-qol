/**
 * Handles Foundry VTT hooks related to actor updates.
 * Specifically manages automatic status effects based on actor state changes.
 */

/**
 * Automatically applies the "dead" status effect to NPCs when their HP reaches 0.
 * Called via the updateActor hook.
 *
 * @param {Actor} actor - The actor document being updated.
 * @param {object} updateData - The data being updated.
 * @param {object} options - Additional options passed to the update.
 * @param {string} userId - The ID of the user performing the update.
 */
export async function handleNPCDeathStatusUpdate(
    actor,
    updateData,
    options,
    userId
) {
    // Only let the GM client handle this to prevent multiple clients from triggering the same action
    if (!game.user.isGM) {
        return;
    }

    // Check if the feature is enabled
    if (!game.settings.get("dcc-qol", "automateNPCDeathStatus")) {
        return;
    }

    // Only proceed if this is an NPC
    if (actor?.type !== "NPC") {
        return;
    }

    // Check if HP was updated in this change
    const hpUpdate = updateData?.system?.attributes?.hp;
    if (!hpUpdate || hpUpdate.hasOwnProperty("value") === false) {
        return;
    }

    const statusId = "dead";

    // Only apply death status if HP is 0 or below and the actor does not already have the status
    if (hpUpdate.value > 0 || actor.statuses?.has(statusId)) {
        return;
    }

    try {
        // Apply the status directly since we're on the GM client
        await actor.toggleStatusEffect(statusId);

        // Create chat message announcing the status change
        const statusConfig = CONFIG.statusEffects.find(
            (s) => s.id === statusId
        );
        const localizedStatusName = statusConfig
            ? game.i18n
                  .localize(statusConfig.name || statusConfig.label || statusId)
                  .toLowerCase()
            : statusId;

        await ChatMessage.create({
            speaker: ChatMessage.getSpeaker({ actor: actor }),
            content: `${actor.name} is now ${localizedStatusName}.`,
        });
    } catch (error) {
        console.error(
            `DCC-QOL | Error applying status ${statusId} to NPC ${actor.name}:`,
            error
        );
    }
}
