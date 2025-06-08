/* globals jest, describe, it, expect, beforeEach, game */

import { createMockPc, createMockNpc } from "../__mocks__/mock-data.js";
import {
    _modifyFumbleDieForTargetPCLuck,
    _modifyCritRollForTargetPCLuck,
} from "../hooks/attackRollHooks.js";

describe("Attack Roll Hooks", () => {
    describe("Target PC Luck Modifiers", () => {
        let mockPCTarget, mockNPCTarget, mockMessageData;

        beforeEach(() => {
            // Create mock PC with +1 luck modifier
            mockPCTarget = createMockPc();

            // Create mock NPC with 0 luck modifier
            mockNPCTarget = createMockNpc();

            // Basic message data structure that the functions expect
            mockMessageData = {
                system: {
                    fumbleRollFormula: "",
                    critRollFormula: "",
                },
            };

            // Mock the DCC dice chain functionality
            game.dcc = {
                DiceChain: {
                    bumpDie: jest.fn((baseDie, modifier) => {
                        // Simple mock implementation that simulates bumping dice
                        const dieMap = {
                            "1d4": { "-1": "1d3", 1: "1d5" },
                            "1d6": { "-1": "1d4", 1: "1d8" },
                            "1d8": { "-1": "1d6", 1: "1d10" },
                            "1d10": { "-1": "1d8", 1: "1d12" },
                            "1d12": { "-1": "1d10", 1: "1d14" },
                        };

                        return dieMap[baseDie]?.[modifier] || baseDie;
                    }),
                },
            };
        });

        describe("_modifyFumbleDieForTargetPCLuck", () => {
            it("should increase fumble die to d12 when fumbling against a PC with +1 luck mod", () => {
                // Arrange
                const messageData = {
                    system: {
                        fumbleRollFormula: "",
                    },
                };
                const isFumble = true;
                const targetActor = mockPCTarget; // Has +1 luck modifier

                // Act
                _modifyFumbleDieForTargetPCLuck(
                    messageData,
                    isFumble,
                    targetActor
                );

                // Assert
                expect(game.dcc.DiceChain.bumpDie).toHaveBeenCalledWith(
                    "1d10",
                    "1"
                );
                expect(messageData.system.fumbleRollFormula).toBe("1d12"); // 1d10 bumped up by +1
            });

            it("should not modify fumble die when not a fumble", () => {
                // Arrange
                const messageData = {
                    system: {
                        fumbleRollFormula: "",
                    },
                };
                const isFumble = false;
                const targetActor = mockPCTarget;

                // Act
                _modifyFumbleDieForTargetPCLuck(
                    messageData,
                    isFumble,
                    targetActor
                );

                // Assert
                expect(messageData.system.fumbleRollFormula).toBe(""); // Unchanged
            });

            it("should not modify fumble die when target is not a PC", () => {
                // Arrange
                const messageData = {
                    system: {
                        fumbleRollFormula: "",
                    },
                };
                const isFumble = true;
                const targetActor = mockNPCTarget; // This is an NPC, not a PC

                // Act
                _modifyFumbleDieForTargetPCLuck(
                    messageData,
                    isFumble,
                    targetActor
                );

                // Assert
                expect(messageData.system.fumbleRollFormula).toBe(""); // Unchanged
            });

            it("should set base fumble die when PC has zero luck modifier", () => {
                // Arrange
                const messageData = {
                    system: {
                        fumbleRollFormula: "",
                    },
                };
                const isFumble = true;
                const targetActor = createMockPc({
                    system: {
                        abilities: {
                            lck: {
                                mod: 0, // Zero luck modifier
                                value: 10,
                            },
                        },
                    },
                });

                // Act
                _modifyFumbleDieForTargetPCLuck(
                    messageData,
                    isFumble,
                    targetActor
                );

                // Assert
                expect(game.dcc.DiceChain.bumpDie).toHaveBeenCalledWith(
                    "1d10",
                    "0"
                );
                expect(messageData.system.fumbleRollFormula).toBe("1d10"); // Base die with 0 luck
            });

            it("should reduce fumble die to d8 when fumbling against a PC with -1 luck mod", () => {
                // Arrange
                const messageData = {
                    system: {
                        fumbleRollFormula: "",
                    },
                };
                const isFumble = true;
                const targetActor = createMockPc({
                    system: {
                        abilities: {
                            lck: {
                                mod: -1, // Negative luck modifier
                                value: 8,
                            },
                        },
                    },
                });

                // Act
                _modifyFumbleDieForTargetPCLuck(
                    messageData,
                    isFumble,
                    targetActor
                );

                // Assert
                expect(game.dcc.DiceChain.bumpDie).toHaveBeenCalledWith(
                    "1d10",
                    "-1"
                );
                expect(messageData.system.fumbleRollFormula).toBe("1d8"); // 1d10 bumped down by -1
            });
        });

        describe("_modifyCritRollForTargetPCLuck", () => {
            it("should apply luck penalty to crit roll when critting against a PC with positive luck", () => {
                // Arrange
                const messageData = {
                    system: {
                        critRollFormula: "1d6+4", // Base crit formula
                    },
                };
                const isCrit = true;
                const targetActor = mockPCTarget; // Has +1 luck modifier

                // Act
                _modifyCritRollForTargetPCLuck(
                    messageData,
                    isCrit,
                    targetActor
                );

                // Assert
                // Positive luck (+1) should apply as a negative penalty (-1)
                expect(messageData.system.critRollFormula).toBe("1d6+4-1");
            });

            it("should apply luck bonus to crit roll when critting against a PC with negative luck", () => {
                // Arrange
                const messageData = {
                    system: {
                        critRollFormula: "1d6+4",
                    },
                };
                const isCrit = true;
                const targetActor = createMockPc({
                    system: {
                        abilities: {
                            lck: {
                                mod: -2, // Negative luck modifier
                                value: 6,
                            },
                        },
                    },
                });

                // Act
                _modifyCritRollForTargetPCLuck(
                    messageData,
                    isCrit,
                    targetActor
                );

                // Assert
                // Negative luck (-2) should apply as a positive bonus (+2)
                expect(messageData.system.critRollFormula).toBe("1d6+4+2");
            });

            it("should not modify crit roll when not a critical hit", () => {
                // Arrange
                const messageData = {
                    system: {
                        critRollFormula: "1d6+4",
                    },
                };
                const isCrit = false;
                const targetActor = mockPCTarget;

                // Act
                _modifyCritRollForTargetPCLuck(
                    messageData,
                    isCrit,
                    targetActor
                );

                // Assert
                expect(messageData.system.critRollFormula).toBe("1d6+4"); // Unchanged
            });

            it("should not modify crit roll when target is not a PC", () => {
                // Arrange
                const messageData = {
                    system: {
                        critRollFormula: "1d6+4",
                    },
                };
                const isCrit = true;
                const targetActor = mockNPCTarget; // This is an NPC, not a PC

                // Act
                _modifyCritRollForTargetPCLuck(
                    messageData,
                    isCrit,
                    targetActor
                );

                // Assert
                expect(messageData.system.critRollFormula).toBe("1d6+4"); // Unchanged
            });

            it("should not modify crit roll when PC has zero luck modifier", () => {
                // Arrange
                const messageData = {
                    system: {
                        critRollFormula: "1d6+4",
                    },
                };
                const isCrit = true;
                const targetActor = createMockPc({
                    system: {
                        abilities: {
                            lck: {
                                mod: 0, // Zero luck modifier
                                value: 10,
                            },
                        },
                    },
                });

                // Act
                _modifyCritRollForTargetPCLuck(
                    messageData,
                    isCrit,
                    targetActor
                );

                // Assert
                expect(messageData.system.critRollFormula).toBe("1d6+4"); // Unchanged when luck is 0
            });

            it("should handle empty critRollFormula gracefully", () => {
                // Arrange
                const messageData = {
                    system: {
                        critRollFormula: "", // Empty formula
                    },
                };
                const isCrit = true;
                const targetActor = mockPCTarget;

                // Act
                _modifyCritRollForTargetPCLuck(
                    messageData,
                    isCrit,
                    targetActor
                );

                // Assert
                expect(messageData.system.critRollFormula).toBe(""); // Should remain empty
            });
        });
    });
});
