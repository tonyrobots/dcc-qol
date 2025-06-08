/*
 * Provides factory functions for creating mock data for tests.
 */

// A standard mock melee weapon
export const mockMeleeWeapon = {
    _id: "mock-melee-weapon-id",
    name: "Sword",
    type: "weapon",
    system: {
        damage: "1d8",
        melee: true,
        range: "5ft",
        equipped: true,
        trained: true,
        twoHanded: false,
    },
};

// A standard mock ranged weapon
export const mockRangedWeapon = {
    _id: "mock-ranged-weapon-id",
    name: "Bow",
    type: "weapon",
    system: {
        damage: "1d6",
        melee: false,
        range: "30/60/90",
        equipped: true,
        trained: true,
        twoHanded: true,
    },
};

/**
 * Creates a mock PC Actor.
 * @param {Object} [options={}] - Optional data to override the default PC data.
 * @returns {ActorMock} A new mock PC actor instance.
 */
export function createMockPc(options = {}) {
    const pcData = {
        _id: "mock-pc-id",
        name: "Test PC",
        type: "Player",
        items: [mockMeleeWeapon, mockRangedWeapon],
        system: {
            abilities: {
                lck: {
                    mod: 1, // Default +1 luck modifier
                    value: 13,
                },
            },
            attributes: {
                ac: {
                    value: 15,
                },
            },
        },
        // Add other PC-specific data here if needed
        ...options,
    };
    return new Actor(pcData);
}

/**
 * Creates a mock NPC Actor.
 * @param {Object} [options={}] - Optional data to override the default NPC data.
 * @returns {ActorMock} A new mock NPC actor instance.
 */
export function createMockNpc(options = {}) {
    const npcData = {
        _id: "mock-npc-id",
        name: "Test NPC",
        type: "NPC",
        items: [mockMeleeWeapon],
        system: {
            abilities: {
                lck: {
                    mod: 0, // NPCs typically have 0 luck modifier
                    value: 10,
                },
            },
            attributes: {
                ac: {
                    value: 12,
                },
            },
        },
        // Add other NPC-specific data here if needed
        ...options,
    };
    return new Actor(npcData);
}
