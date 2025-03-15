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

    // Debug weapon properties if enabled
    if (game.settings.get("dcc-qol", "log")) {
        console.log("DCC-QOL | Weapon properties:", {
            name: weapon.name,
            equipped: weapon.system.equipped,
            trained: weapon.system.trained,
            melee: weapon.system.melee,
            range: weapon.system.range,
            options: options,
        });
    }

    // Basic weapon type
    if (weapon.system.melee) {
        properties.push("Melee");
    } else {
        properties.push("Ranged");
        if (weapon.system.range) {
            properties.push(`Range: ${weapon.system.range} ft`);
        }
    }

    // Show equipment state
    if (weapon.system.equipped === true) {
        properties.push("Equipped");
    } else if (weapon.system.equipped === false) {
        properties.push("Not Equipped");
    }

    // Show training status
    if (weapon.system.trained === true) {
        properties.push("Trained");
    } else if (weapon.system.trained === false) {
        properties.push("Untrained");
    }

    // Add other relevant properties
    if (weapon.system.twoHanded) properties.push("Two-Handed");

    // Special attack properties
    if (options.backstab) properties.push("Backstab");
    if (options.useDeedDie) properties.push("Warrior Attack");

    // Add damage type if present
    if (weapon.system.damageType && weapon.system.damageType !== "none") {
        properties.push(weapon.system.damageType.capitalize());
    }

    // Add other relevant weapon qualities
    if (weapon.system.qualities) {
        const qualities = weapon.system.qualities
            .split(",")
            .map((q) => q.trim());
        properties.push(...qualities.filter((q) => q.length > 0));
    }

    if (game.settings.get("dcc-qol", "log")) {
        console.log("DCC-QOL | Final weapon properties:", properties);
    }

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

/**
 * Look up a critical hit result from the compendium
 * @param {Roll} roll - The roll to look up
 * @param {string} critTableName - The name of the crit table to use
 * @returns {Promise<Object|null>} The table result, or null if not found
 */
export async function lookupCritResult(roll, critTableName) {
    try {
        if (!roll || !critTableName) {
            console.warn("DCC-QOL | Invalid arguments for crit lookup", {
                roll,
                critTableName,
            });
            ui.notifications.error(
                game.i18n.localize("DCC-QOL.ErrorLookingUpCrit")
            );
            return null;
        }

        if (game.settings.get("dcc-qol", "log")) {
            console.log(
                `DCC-QOL | Looking up crit result: ${roll.total} on ${critTableName}`
            );
        }

        // Format the crit table name correctly
        let formattedCritTableName = critTableName;
        if (!formattedCritTableName.startsWith("Crit Table ")) {
            const match = critTableName.match(/crit table ([^:]+)(?::|\s|$)/i);
            if (match) {
                formattedCritTableName = `Crit Table ${match[1].trim()}`;
            } else {
                console.warn(
                    `DCC-QOL | Could not parse crit table name: ${critTableName}`
                );
                ui.notifications.error(
                    `Could not parse critical hit table name: ${critTableName}`
                );
                return null;
            }
        }

        // Try multiple approaches to lookup the result
        let critResult = null;
        let methodUsed = null;

        // Approach 1: Directly check available compendium packs
        if (!critResult) {
            try {
                // The actual lookup function implementation
                const tableID = formattedCritTableName.replace(
                    "Crit Table ",
                    ""
                );

                // Look through critical hit packs
                for (const packName of game.settings.get(
                    "dcc",
                    "criticalHitPacks"
                ) || ["dcc-core-book.dcc-crit-tables"]) {
                    if (!packName) continue;

                    const pack = game.packs.get(packName);
                    if (!pack) continue;

                    await pack.getIndex();
                    const entry = pack.index.find((e) =>
                        e.name.startsWith(formattedCritTableName)
                    );
                    if (!entry) continue;

                    const table = await pack.getDocument(entry._id);
                    const result = table.getResultsForRoll(roll.total);
                    if (result && result.length > 0) {
                        critResult = result[0];
                        methodUsed = "Direct compendium lookup";
                        break;
                    }
                }
            } catch (err) {
                console.warn(
                    "DCC-QOL | Error looking up crit result from compendium:",
                    err
                );
            }
        }

        // Approach 2: Use game.dcc.getCritTableResult if available
        if (
            !critResult &&
            game.dcc &&
            typeof game.dcc.getCritTableResult === "function"
        ) {
            try {
                critResult = await game.dcc.getCritTableResult(
                    roll,
                    formattedCritTableName
                );
                methodUsed = "game.dcc.getCritTableResult";
            } catch (err) {
                console.warn(
                    "DCC-QOL | Error using game.dcc.getCritTableResult:",
                    err
                );
            }
        }

        // Approach 3: Use game.dcc.utilities.getCritTableResult if available
        if (
            !critResult &&
            game.dcc?.utilities &&
            typeof game.dcc.utilities.getCritTableResult === "function"
        ) {
            try {
                critResult = await game.dcc.utilities.getCritTableResult(
                    roll,
                    formattedCritTableName
                );
                methodUsed = "game.dcc.utilities.getCritTableResult";
            } catch (err) {
                console.warn(
                    "DCC-QOL | Error using game.dcc.utilities.getCritTableResult:",
                    err
                );
            }
        }

        // Approach 4: Use the chat lookup method if available
        if (
            !critResult &&
            game.dcc?.chat &&
            typeof game.dcc.chat.lookupCriticalRoll === "function"
        ) {
            try {
                const mockMessage = {
                    rolls: [roll],
                    isContentVisible: true,
                    flavor: `Critical (${formattedCritTableName.replace(
                        "Crit Table ",
                        ""
                    )})`,
                };
                const mockHtml = $('<div class="message-content"></div>');

                await game.dcc.chat.lookupCriticalRoll(mockMessage, mockHtml);
                const resultText = mockHtml.html();

                if (
                    resultText &&
                    !resultText.includes("Unable to find crit result")
                ) {
                    critResult = { text: resultText };
                    methodUsed = "game.dcc.chat.lookupCriticalRoll";
                }
            } catch (err) {
                console.warn(
                    "DCC-QOL | Error using game.dcc.chat.lookupCriticalRoll:",
                    err
                );
            }
        }

        // Process and return result if found
        if (critResult) {
            if (game.settings.get("dcc-qol", "log")) {
                console.log(
                    `DCC-QOL | Found crit result using ${methodUsed}:`,
                    critResult
                );
            }
            return {
                text: critResult.text || critResult,
                entry: critResult,
            };
        } else {
            console.warn(
                `DCC-QOL | No crit result found for roll ${roll.total} in ${formattedCritTableName}`
            );
            ui.notifications.warn(
                `No result found for ${roll.total} in critical hit table ${formattedCritTableName}`
            );
            return null;
        }
    } catch (error) {
        console.error("DCC-QOL | Error looking up crit result:", error);
        ui.notifications.error(
            `Error looking up critical hit result: ${error.message}`
        );
        return null;
    }
}

/**
 * Look up a fumble result from the compendium
 * @param {Roll} roll - The roll to look up
 * @returns {Promise<Object|null>} The table result, or null if not found
 */
export async function lookupFumbleResult(roll) {
    try {
        if (!roll) {
            console.warn("DCC-QOL | Invalid roll for fumble lookup");
            ui.notifications.error(
                game.i18n.localize("DCC-QOL.ErrorLookingUpFumble")
            );
            return null;
        }

        if (game.settings.get("dcc-qol", "log")) {
            console.log(`DCC-QOL | Looking up fumble result: ${roll.total}`);
        }

        // Try multiple approaches to find the fumble result
        let fumbleResult = null;
        let methodUsed = null;

        // Approach 1: Direct lookup in fumble table compendium pack
        if (!fumbleResult) {
            try {
                const fumbleTableName =
                    game.settings.get("dcc", "fumbleTable") ||
                    "dcc-core-book.dcc-fumble-tables.Fumble Table";
                const pathParts = fumbleTableName.split(".");

                if (pathParts.length >= 2) {
                    const packName = pathParts.slice(0, 2).join(".");
                    const tableName =
                        pathParts.length === 3 ? pathParts[2] : "Fumble Table";

                    const pack = game.packs.get(packName);
                    if (pack) {
                        await pack.getIndex();
                        const entry = pack.index.find(
                            (e) => e.name === tableName
                        );

                        if (entry) {
                            const table = await pack.getDocument(entry._id);
                            const result = table.getResultsForRoll(roll.total);

                            if (result && result.length > 0) {
                                fumbleResult = result[0];
                                methodUsed = "Direct compendium lookup";
                            }
                        }
                    }
                }
            } catch (err) {
                console.warn(
                    "DCC-QOL | Error looking up fumble result from compendium:",
                    err
                );
            }
        }

        // Approach 2: Use game.dcc.getFumbleTableResult if available
        if (
            !fumbleResult &&
            game.dcc &&
            typeof game.dcc.getFumbleTableResult === "function"
        ) {
            try {
                fumbleResult = await game.dcc.getFumbleTableResult(roll);
                methodUsed = "game.dcc.getFumbleTableResult";
            } catch (err) {
                console.warn(
                    "DCC-QOL | Error using game.dcc.getFumbleTableResult:",
                    err
                );
            }
        }

        // Approach 3: Use game.dcc.utilities.getFumbleTableResult if available
        if (
            !fumbleResult &&
            game.dcc?.utilities &&
            typeof game.dcc.utilities.getFumbleTableResult === "function"
        ) {
            try {
                fumbleResult = await game.dcc.utilities.getFumbleTableResult(
                    roll
                );
                methodUsed = "game.dcc.utilities.getFumbleTableResult";
            } catch (err) {
                console.warn(
                    "DCC-QOL | Error using game.dcc.utilities.getFumbleTableResult:",
                    err
                );
            }
        }

        // Approach 4: Use the chat lookup method if available
        if (
            !fumbleResult &&
            game.dcc?.chat &&
            typeof game.dcc.chat.lookupFumbleRoll === "function"
        ) {
            try {
                const mockMessage = {
                    rolls: [roll],
                    isContentVisible: true,
                    flavor: game.i18n.localize("DCC.Fumble"),
                };
                const mockHtml = $('<div class="message-content"></div>');
                const mockData = {};

                await game.dcc.chat.lookupFumbleRoll(
                    mockMessage,
                    mockHtml,
                    mockData
                );
                const resultText = mockHtml.html();

                if (
                    resultText &&
                    !resultText.includes("Unable to find fumble result")
                ) {
                    fumbleResult = { text: resultText };
                    methodUsed = "game.dcc.chat.lookupFumbleRoll";
                }
            } catch (err) {
                console.warn(
                    "DCC-QOL | Error using game.dcc.chat.lookupFumbleRoll:",
                    err
                );
            }
        }

        // Process and return result if found
        if (fumbleResult) {
            if (game.settings.get("dcc-qol", "log")) {
                console.log(
                    `DCC-QOL | Found fumble result using ${methodUsed}:`,
                    fumbleResult
                );
            }
            return fumbleResult;
        } else {
            console.warn(
                `DCC-QOL | No fumble result found for roll ${roll.total}`
            );
            ui.notifications.warn(
                `No result found for ${roll.total} in fumble table`
            );
            return null;
        }
    } catch (error) {
        console.error("DCC-QOL | Error looking up fumble result:", error);
        ui.notifications.error(
            `Error looking up fumble result: ${error.message}`
        );
        return null;
    }
}
