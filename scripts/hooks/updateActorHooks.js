/**
 * Handles Foundry VTT hooks related to actor updates.
 * Specifically manages automatic status effects based on actor state changes.
 */

import { socket } from "../dcc-qol.js";

// Track actors currently being processed to prevent duplicate status applications
const processingActors = new Set();

/**
 * Clear the processing actors set (primarily for testing)
 * @private
 */
export function _clearProcessingActors() {
    processingActors.clear();
}

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
    if (!hpUpdate || hpUpdate.hasOwnProperty("value") === false) {
        return;
    }

    const statusId = "dead";

    // Only apply death status if HP is 0 or below
    if (hpUpdate.value > 0) {
        return;
    }

    // Don't apply if actor already has the status
    if (actor.statuses?.has(statusId)) {
        return;
    }

    // V13 Fix: Prevent duplicate status applications due to multiple hook calls
    // Use the actor's _id to track processing state
    const actorId = actor._id;

    if (processingActors.has(actorId)) {
        return;
    }

    // Mark this actor as being processed
    processingActors.add(actorId);

    try {
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
    } finally {
        // Always clean up the processing flag after a short delay
        // This allows for the status to be applied and prevents permanent blocking
        setTimeout(() => {
            processingActors.delete(actorId);
        }, 1000);
    }
}
