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
    // Only proceed if this is an NPC
    if (actor?.type !== "NPC") {
        return;
    }

    // Check if HP was updated in this change
    const hpUpdate = updateData?.system?.attributes?.hp;
    if (hpUpdate === undefined) {
        return;
    }

    // // Get the current HP value
    // const currentHP =
    //     hpUpdate?.value !== undefined
    //         ? hpUpdate.value
    //         : actor.system.attributes?.hp?.value;

    // Only apply death status if HP is 0 or below
    if (hpUpdate.value > 0) {
        return;
    }

    // Check if the "dead" status effect is already applied to avoid infinite loops
    const hasDeadStatus = actor.effects.some((effect) =>
        effect.statuses?.has("dead")
    );

    if (hasDeadStatus) {
        return;
    }

    try {
        console.log(
            `DCC-QOL | Applying dead status to NPC ${actor.name} (HP: ${hpUpdate.value})`
        );

        // Apply the dead status effect
        await actor.toggleStatusEffect("dead");

        console.log(
            `DCC-QOL | Successfully applied dead status to NPC ${actor.name}`
        );
    } catch (error) {
        console.error(
            `DCC-QOL | Error applying dead status to NPC ${actor.name}:`,
            error
        );
    }
}
