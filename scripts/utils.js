/* global game */

/**
 * Extracts the first valid TokenDocument from a Set of targets.
 * Handles the common pattern where hooks provide targets as a Set<Token>.
 * Includes basic validation.
 *
 * @param {Set<Token>} targetsSet - The Set of targeted tokens (e.g., game.user.targets).
 * @returns {TokenDocument | null} The first valid TokenDocument object, or null if none found.
 */
export function getFirstTarget(targetsSet) {
    if (!(targetsSet instanceof Set) || targetsSet.size === 0) {
        console.debug(
            "DCC-QOL Utils | getFirstTarget: Invalid or empty target set provided."
        );
        return null;
    }

    const targetToken = targetsSet.first();
    if (!targetToken?.document) {
        console.debug(
            "DCC-QOL Utils | getFirstTarget: First element in target set is invalid or has no document."
        );
        return null;
    }

    const targetDocument = targetToken.document;

    console.debug(
        `DCC-QOL Utils | getFirstTarget: Returning target document ${
            targetDocument.name || targetDocument.id
        }`
    );
    return targetDocument;
}

/*
 * Measure distance between 2 tokens (documents), taking size of tokens into account
 * @param {Object} token1D    The token.document "from"
 * @param {Object} token2D    The token.document "to"
 */
export async function measureTokenDistance(token1D, token2D) {
    const gs = game.canvas.dimensions.size;
    // originate ray from center of token1 to center of token2
    const ray = new Ray(token1D.object.center, token2D.object.center);

    const nx = Math.ceil(Math.abs(ray.dx / gs));
    const ny = Math.ceil(Math.abs(ray.dy / gs));

    // Get the number of straight and diagonal moves
    const nDiagonal = Math.min(nx, ny);
    const nStraight = Math.abs(ny - nx);

    // Diagonals in DDC calculated as equal to (1.0x) the straight distance - pythagoras be damned!
    const distance = Math.floor(nDiagonal * 1.0 + nStraight);
    let distanceOnGrid = distance * game.canvas.dimensions.distance;
    // make adjustment to account for size of token. Using width as tokens are assumed to be square.
    let adjustment = Math.round((token1D.width + token2D.width) * 0.5) - 1;

    return distanceOnGrid - adjustment * game.canvas.dimensions.distance;
}

/**
 * Checks if a target token has any adjacent allied tokens
 * @param {TokenDocument} targetTokenDocument - The token document to check for adjacent allies
 * @returns {Promise<boolean>} True if target has adjacent allies, false otherwise
 */

export async function checkFiringIntoMelee(targetTokenDocument) {
    let firingIntoMelee = false;

    for (const token of game.canvas.tokens.placeables) {
        if (!(token.document === targetTokenDocument)) {
            // Check if the token is an ally and in melee range
            if (
                (await this.measureTokenDistance(
                    targetTokenDocument,
                    token.document
                )) <= 5 &&
                token.document.disposition === 1
            ) {
                return true;
            }
        }
    }
    return firingIntoMelee;
}

/**
 * Gets the properties of a weapon
 * @param {Object} weapon - The weapon object
 * @param {Object} options - The options object
 * @returns {Array} The properties of the weapon
 */
export async function getWeaponProperties(weapon, options) {
    const properties = [];

    if (weapon.system.melee) {
        properties.push("Melee");
    } else {
        properties.push("Ranged");
        properties.push(weapon.system.range + " ft.");
    }
    if (weapon.system.equipped) {
        properties.push("Equipped");
    } else {
        properties.push("Not Equipped");
    }
    if (weapon.system.trained) {
        properties.push("Trained");
    } else {
        properties.push("Not Trained");
    }
    if (weapon.system.twoHanded) {
        properties.push("Two handed");
    }
    if (options.backstab) {
        properties.push("Backstab");
    }
    return properties;
}
