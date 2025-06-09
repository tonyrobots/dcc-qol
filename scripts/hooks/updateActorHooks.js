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
    if (hpUpdate === undefined) {
        return;
    }

    // Only apply death status if HP is 0 or below
    if (hpUpdate.value > 0) {
        return;
    }

    const statusId = "dead";

    // Check if actor already has that statusId set
    // Use the actor.statuses Set which contains language-independent status IDs
    if (actor.statuses?.has(statusId)) {
        return;
    }

    try {
        console.log(
            `DCC-QOL | Applying ${statusId} status to NPC ${actor.name} (HP: ${hpUpdate.value})`
        );
        await actor.toggleStatusEffect("dead");
    } catch (error) {
        console.error(
            `DCC-QOL | Error applying status: ${statusId} to NPC ${actor.name}:`,
            error
        );
    }
}
