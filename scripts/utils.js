// Utility functions for DCC-QOL

/**
 * Measure distance between 2 tokens, taking size into account
 */
export async function measureTokenDistance(token1D, token2D) {
    const gs = game.canvas.dimensions.size;
    const ray = new Ray(token1D.object.center, token2D.object.center);

    const nx = Math.ceil(Math.abs(ray.dx / gs));
    const ny = Math.ceil(Math.abs(ray.dy / gs));

    const nDiagonal = Math.min(nx, ny);
    const nStraight = Math.abs(ny - nx);

    // Diagonals in DCC calculated as equal to straight distance
    const distance = Math.floor(nDiagonal * 1.0 + nStraight);
    let distanceOnGrid = distance * game.canvas.dimensions.distance;

    // Adjust for token sizes
    let adjustment = Math.round((token1D.width + token2D.width) * 0.5) - 1;
    return distanceOnGrid - adjustment * game.canvas.dimensions.distance;
}

/**
 * Check if target is adjacent to any allies
 */
export async function checkFiringIntoMelee(targetTokenDocument) {
    for (const token of game.canvas.tokens.placeables) {
        if (token.document === targetTokenDocument) continue;

        // Check if token is an ally and in melee range
        if (
            (await measureTokenDistance(targetTokenDocument, token.document)) <=
                5 &&
            token.document.disposition === 1
        ) {
            return true;
        }
    }
    return false;
}

/**
 * Extract die value from a dice string
 */
export function extractDieValue(diceString) {
    const pattern = /\d*d(\d+)[+-]?/;
    const match = diceString.match(pattern);
    return match ? parseInt(match[1], 10) : null;
}

/**
 * Get weapon properties for display
 */
export async function getWeaponProperties(weapon, options) {
    const properties = [];

    if (weapon.system.melee) {
        properties.push("Melee");
    } else {
        properties.push("Ranged");
        properties.push(weapon.system.range + " ft.");
    }

    if (weapon.system.equipped) properties.push("Equipped");
    else properties.push("Not Equipped");

    if (weapon.system.trained) properties.push("Trained");
    else properties.push("Not Trained");

    if (weapon.system.twoHanded) properties.push("Two handed");
    if (options.backstab) properties.push("Backstab");

    return properties;
}

/**
 * Debug utility to explore object structures
 * @param {Object} obj - The object to explore
 * @param {string} name - A name for the object
 * @param {Object} options - Options for exploration
 * @param {number} options.depth - How deep to explore (default: 2)
 * @param {boolean} options.methods - Include methods (default: false)
 * @param {boolean} options.console - Log to console (default: true)
 * @returns {string} A formatted string representation
 */
export function exploreObject(obj, name = "Object", options = {}) {
    const depth = options.depth ?? 2;
    const includeMethods = options.methods ?? false;
    const useConsole = options.console ?? true;

    function getTypeInfo(value) {
        if (value === null) return "null";
        if (value === undefined) return "undefined";

        const type = typeof value;
        if (type === "object") {
            if (Array.isArray(value)) {
                return `Array(${value.length})`;
            }
            if (value instanceof Roll) {
                return `Roll: ${value.formula} = ${value.total}`;
            }
            if (value instanceof foundry.dice.terms.Die) {
                return `Die: d${value.faces}, results: ${value.results
                    .map((r) => r.result)
                    .join(", ")}`;
            }
            try {
                return value.constructor.name || "Object";
            } catch (e) {
                return "Object";
            }
        }
        return type;
    }

    function formatValue(value, currentDepth = 0) {
        if (currentDepth >= depth) return getTypeInfo(value);
        if (value === null || value === undefined) return String(value);

        const type = typeof value;
        if (type === "object") {
            if (Array.isArray(value)) {
                if (value.length === 0) return "[]";
                if (currentDepth === depth - 1)
                    return `[Array(${value.length})]`;

                const items = value
                    .slice(0, 5)
                    .map((item) => formatValue(item, currentDepth + 1))
                    .join(", ");
                return `[${items}${value.length > 5 ? ", ..." : ""}]`;
            }

            try {
                const entries = Object.entries(value)
                    .filter(
                        ([k, v]) => includeMethods || typeof v !== "function"
                    )
                    .slice(0, 5);

                if (entries.length === 0) return "{}";
                if (currentDepth === depth - 1)
                    return `{${getTypeInfo(value)}}`;

                const props = entries
                    .map(
                        ([k, v]) => `${k}: ${formatValue(v, currentDepth + 1)}`
                    )
                    .join(", ");

                const obj =
                    Object.keys(value).length > 5 ? `${props}, ...` : props;
                return `{${obj}}`;
            } catch (e) {
                return `{${getTypeInfo(value)}}`;
            }
        }

        if (type === "string")
            return `"${value.substring(0, 40)}${
                value.length > 40 ? "..." : ""
            }"`;
        return String(value);
    }

    function explore(obj, prefix = "", currentDepth = 0) {
        if (currentDepth >= depth) return "";
        if (obj === null || obj === undefined)
            return `${prefix}${String(obj)}\n`;

        let result = "";

        try {
            const entries = Object.entries(obj).filter(
                ([k, v]) => includeMethods || typeof v !== "function"
            );

            for (const [key, value] of entries) {
                const type = getTypeInfo(value);
                const newPrefix = `${prefix}${key}: `;

                result += `${newPrefix}(${type}) `;

                if (
                    typeof value === "object" &&
                    value !== null &&
                    currentDepth < depth - 1
                ) {
                    result +=
                        "\n" + explore(value, prefix + "  ", currentDepth + 1);
                } else {
                    result += formatValue(value, currentDepth) + "\n";
                }
            }
        } catch (e) {
            result += `${prefix}[Error exploring: ${e.message}]\n`;
        }

        return result;
    }

    const result = `===== ${name} =====\n${explore(obj)}=================`;

    if (useConsole) {
        console.log(result);
    }

    return result;
}

/**
 * Add an "Explore Object" button to the dev mode tools panel if DevMode module is active
 */
export function registerDevModeTools() {
    if (!game.modules.get("_dev-mode")?.active) return;

    Hooks.once("devModeReady", ({ registerPackageDebugFlag }) => {
        registerPackageDebugFlag("dcc-qol");

        DevModeTools.registerTool({
            name: "dcc-qol.exploreMessage",
            label: "Explore Last Message",
            icon: "fas fa-search",
            visible: true,
            onClick: () => {
                const lastMessage =
                    game.messages.contents[game.messages.contents.length - 1];
                exploreObject(lastMessage, "Last Chat Message", { depth: 3 });
            },
        });

        DevModeTools.registerTool({
            name: "dcc-qol.exploreRoll",
            label: "Explore Last Roll",
            icon: "fas fa-dice-d20",
            visible: true,
            onClick: () => {
                const lastMessage = game.messages.contents
                    .filter((m) => m.rolls?.length)
                    .pop();

                if (lastMessage) {
                    exploreObject(lastMessage.rolls[0], "Last Roll", {
                        depth: 3,
                    });
                } else {
                    ui.notifications.warn("No roll found in recent messages");
                }
            },
        });
    });
}
