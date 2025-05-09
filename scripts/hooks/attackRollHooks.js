/**
 * Handles Foundry VTT hooks related to the data generation and mechanics of attack rolls.
 * This includes modifying roll terms, preparing data before a chat message is created,
 * or reacting to events within the attack sequence itself.
 */
import { getFirstTarget } from "../utils.js";
import { checkFiringIntoMelee, getWeaponFromActorById } from "../utils.js";

/**
 * Test Listener for the dcc.modifyAttackRollTerms hook.
 * Adds a bonus based on the length of the target's name.
 * @param {Array} terms - The array of roll terms.
 * @param {Actor} actor - The attacking actor.
 * @param {Item} weapon - The weapon item used.
 * @param {TokenDocument | TokenDocument[] | undefined} targets - The target(s) passed by the hook.
 * @param {object} options - Roll options.
 */
export function addTestBonus(terms, actor, weapon, targets, options) {
    console.debug("DCC-QOL | addTestBonus hook listener called");
    console.log("DCC-QOL Hook | dcc.modifyAttackRollTerms triggered!");
    console.log(
        "DCC-QOL Hook | Initial terms:",
        JSON.parse(JSON.stringify(terms))
    ); // Log initial terms
    console.log("DCC-QOL Hook | Targets received:", targets); // Log received targets

    // Determine the first valid target document
    let targetDocument = undefined;
    if (targets instanceof Set && targets.size > 0) {
        // Standard Foundry target Set<Token>
        targetDocument = targets.first()?.document; // Get the document from the first Token
    }

    if (targetDocument?.name) {
        const targetName = targetDocument.name;
        const weirdBonusValue = targetName.length;
        console.log(
            `DCC-QOL Hook | Target: ${targetName}, Name Length: ${weirdBonusValue}`
        );

        // Add the new modifier term
        terms.push({
            type: "Modifier",
            label: "Weird Bonus", // Translate if needed: game.i18n.localize("DCC-QOL.WeirdBonusLabel")
            formula: "+" + weirdBonusValue.toString(), // Ensure formula is a string
        });

        console.log("DCC-QOL Hook | Final terms:", terms); // Log terms after modification
    } else {
        console.log(
            "DCC-QOL Hook | No valid target document found in the Set."
        );
    }
}

/**
 * Hooks into 'dcc.rollWeaponAttack' to prepare data for the QoL Attack Card.
 * Augments the messageData object with flags needed by the renderChatMessage hook.
 *
 * @param {Roll[]} rolls - Array of roll objects involved in the attack.
 * @param {object} messageData - The chat message data object before creation.
 */
export async function prepareQoLAttackData(rolls, messageData) {
    const useQoLAttackCard = game.settings.get("dcc-qol", "useQoLAttackCard");
    if (!useQoLAttackCard) {
        return; // Do nothing if the setting is disabled
    }

    console.debug("DCC-QOL | prepareQoLAttackData hook listener called");
    console.debug("DCC-QOL | Received messageData:", messageData);

    // Extract basic data
    const actorId = messageData.system.actorId;
    const weaponId = messageData.system.weaponId;
    const tokenId = messageData.speaker.token; // Attacker's token ID

    // --- Fetch Actor to determine if PC ---
    const actor = game.actors.get(actorId);
    // Adjust 'Player Character' if DCC uses a different type string for PCs
    const isPC = actor && actor.type === "Player";

    const tokenName = messageData.speaker.alias || messageData.speaker.name; // Attacker's display name
    const isCrit = messageData.flags["dcc.isCrit"] || false;
    const isFumble = messageData.flags["dcc.isFumble"] || false;
    const hitsAc = messageData.system.hitsAc; // What AC value the roll hits
    const weapon = getWeaponFromActorById(actor, weaponId);

    // Process Targets using utility function
    const targetsSet = messageData.system.targets; // This is a Set<Token>
    const targetDocument = getFirstTarget(targetsSet); // Get the TokenDocument object

    let targetName = "";
    let targetTokenId = null;
    let hitsTarget = false; // Default to false

    if (targetDocument) {
        targetName = targetDocument.name || "target"; // Get name directly
        targetTokenId = targetDocument.id; // Get ID directly
        const targetActor = targetDocument.actor; // Get actor from document

        if (targetActor) {
            const targetAC = targetActor.system?.attributes?.ac?.value;
            if (targetAC !== undefined && hitsAc !== undefined) {
                hitsTarget =
                    !isFumble && parseInt(hitsAc) >= parseInt(targetAC); // Hit if not a fumble and roll >= AC
                console.debug(
                    `DCC-QOL | Target AC: ${targetAC}, Hits AC: ${hitsAc}, Hits Target: ${hitsTarget}`
                );
            } else {
                console.debug(
                    `DCC-QOL | Could not determine target AC (${targetAC}) or Hits AC (${hitsAc})`
                );
            }
        }
    } else {
        console.debug(
            "DCC-QOL | No valid targets found by getFirstTarget utility."
        );
    }

    // --- Friendly Fire Check ---
    let showFriendlyFireButton = false;
    if (
        game.settings.get("dcc-qol", "automateFriendlyFire") && // if setting is enabled
        isPC &&
        weapon &&
        !weapon.system.melee && // is Ranged weapon
        !hitsTarget &&
        targetDocument
    ) {
        // Missed a specific target
        try {
            showFriendlyFireButton = await checkFiringIntoMelee(targetDocument);
        } catch (e) {
            console.error("DCC-QOL | Error calling checkFiringIntoMelee:", e);
            showFriendlyFireButton = false; // Default to false on error
        }
    }

    // --- Prepare QoL Data ---
    const qolData = {
        isAttackRoll: true, // Flag for the render hook
        actorId: actorId,
        weaponId: weaponId,
        tokenId: tokenId,
        tokenName: tokenName,
        isPC: isPC, // Add the isPC flag here
        target: targetName,
        targettokenId: targetTokenId,
        hitsTarget: hitsTarget,
        isCrit: isCrit,
        isFumble: isFumble,
        deedDieResult: messageData.system?.deedDieRollResult ?? null,
        deedRollSuccess: messageData.system?.deedRollSuccess ?? null,
        isDisplayHitMiss: game.settings.get("dcc-qol", "DisplayHitMiss"), // Get setting value
        hitsAc: hitsAc, // Pass the raw hitsAC value for display when no target
        showFriendlyFireButton: showFriendlyFireButton,
        options: {}, // Placeholder for future options
    };

    // Attach QoL data to message flags
    messageData.flags.dccqol = qolData;

    console.debug(
        "DCC-QOL | Augmented messageData with flags:",
        messageData.flags.dccqol
    );
}
