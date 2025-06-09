/**
 * Handles Foundry VTT hooks related to actor updates.
 * Specifically manages automatic status effects based on actor state changes.
 */

import { socket } from "../dcc-qol.js";

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

    try {
        console.log(
            `DCC-QOL | Requesting ${statusId} status application for NPC ${actor.name} (HP: ${hpUpdate.value})`
        );

        // Use socket to have GM apply the status (handles permissions properly)
        // Pass the actor UUID to preserve token actor context
        const result = await socket.executeAsGM(
            "gmApplyStatus",
            actor.uuid,
            statusId
        );

        if (!result.success) {
            console.warn(
                `DCC-QOL | Failed to apply ${statusId} status to NPC ${actor.name}: ${result.reason}`
            );
        }
    } catch (error) {
        console.error(
            `DCC-QOL | Error requesting status application for NPC ${actor.name}:`,
            error
        );
    }
}
