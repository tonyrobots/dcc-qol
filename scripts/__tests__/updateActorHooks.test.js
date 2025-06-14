/* globals jest, describe, it, expect, beforeEach, game */

import { createMockPc, createMockNpc } from "../__mocks__/mock-data.js";
import { handleNPCDeathStatusUpdate } from "../hooks/updateActorHooks.js";

// Mock the socket module
jest.mock("../dcc-qol.js", () => ({
    socket: {
        executeAsGM: jest.fn(),
    },
}));

import { socket } from "../dcc-qol.js";

describe("Update Actor Hooks", () => {
    describe("handleNPCDeathStatusUpdate", () => {
        let mockNPC, mockPC;

        beforeEach(() => {
            // Mock game.settings.get to control the feature toggle
            game.settings = {
                get: jest.fn((namespace, setting) => {
                    if (
                        namespace === "dcc-qol" &&
                        setting === "automateNPCDeathStatus"
                    ) {
                        return true; // Default: feature enabled
                    }
                    return false;
                }),
            };

            // Reset and mock the socket to return success by default
            socket.executeAsGM.mockClear();
            socket.executeAsGM.mockResolvedValue({ success: true });

            // Create mock actors with proper HP data and UUIDs
            mockNPC = createMockNpc({
                uuid: "Actor.mock-npc-uuid", // Add UUID for socket calls
                system: {
                    attributes: {
                        hp: {
                            value: 10,
                            max: 10,
                        },
                    },
                },
                statuses: new Set(), // Empty status set initially
            });

            mockPC = createMockPc({
                uuid: "Actor.mock-pc-uuid", // Add UUID for socket calls
                system: {
                    attributes: {
                        hp: {
                            value: 10,
                            max: 10,
                        },
                    },
                },
                statuses: new Set(), // Empty status set initially
            });
        });

        describe("when setting is enabled", () => {
            it("should apply dead status to NPC when HP goes from 10 to 0", async () => {
                // Arrange
                const updateData = {
                    system: {
                        attributes: {
                            hp: {
                                value: 0, // HP drops to 0
                            },
                        },
                    },
                };
                const options = {};
                const userId = "test-user-id";

                // Act
                await handleNPCDeathStatusUpdate(
                    mockNPC,
                    updateData,
                    options,
                    userId
                );

                // Assert
                expect(socket.executeAsGM).toHaveBeenCalledWith(
                    "gmApplyStatus",
                    mockNPC.uuid,
                    "dead"
                );
                expect(socket.executeAsGM).toHaveBeenCalledTimes(1);
            });

            it("should NOT apply dead status to PC when HP goes to 0", async () => {
                // Arrange
                const updateData = {
                    system: {
                        attributes: {
                            hp: {
                                value: 0, // HP drops to 0
                            },
                        },
                    },
                };
                const options = {};
                const userId = "test-user-id";

                // Act
                await handleNPCDeathStatusUpdate(
                    mockPC,
                    updateData,
                    options,
                    userId
                );

                // Assert
                expect(socket.executeAsGM).not.toHaveBeenCalled();
            });

            it("should NOT apply dead status to NPC when HP is above 0", async () => {
                // Arrange
                const updateData = {
                    system: {
                        attributes: {
                            hp: {
                                value: 1, // HP is still above 0
                            },
                        },
                    },
                };
                const options = {};
                const userId = "test-user-id";

                // Act
                await handleNPCDeathStatusUpdate(
                    mockNPC,
                    updateData,
                    options,
                    userId
                );

                // Assert
                expect(socket.executeAsGM).not.toHaveBeenCalled();
            });

            it("should NOT apply dead status to NPC when no HP update is present", async () => {
                // Arrange
                const updateData = {
                    // No HP update data
                    system: {
                        attributes: {
                            ac: {
                                value: 0, // Different attribute updated
                            },
                        },
                    },
                };
                const options = {};
                const userId = "test-user-id";

                // Act
                await handleNPCDeathStatusUpdate(
                    mockNPC,
                    updateData,
                    options,
                    userId
                );

                // Assert
                expect(socket.executeAsGM).not.toHaveBeenCalled();
            });

            it("should not request status application if actor already has the status", async () => {
                // Arrange
                mockNPC.statuses.add("dead"); // NPC already has dead status

                const updateData = {
                    system: {
                        attributes: {
                            hp: {
                                value: 0, // HP drops to 0
                            },
                        },
                    },
                };
                const options = {};
                const userId = "test-user-id";

                // Act
                await handleNPCDeathStatusUpdate(
                    mockNPC,
                    updateData,
                    options,
                    userId
                );

                // Assert - Hook should not make the request
                expect(socket.executeAsGM).not.toHaveBeenCalled();
            });

            it("should apply dead status to NPC when HP goes below 0", async () => {
                // Arrange
                const updateData = {
                    system: {
                        attributes: {
                            hp: {
                                value: -5, // HP goes negative
                            },
                        },
                    },
                };
                const options = {};
                const userId = "test-user-id";

                // Act
                await handleNPCDeathStatusUpdate(
                    mockNPC,
                    updateData,
                    options,
                    userId
                );

                // Assert
                expect(socket.executeAsGM).toHaveBeenCalledWith(
                    "gmApplyStatus",
                    mockNPC.uuid,
                    "dead"
                );
                expect(socket.executeAsGM).toHaveBeenCalledTimes(1);
            });
        });

        describe("when setting is disabled", () => {
            beforeEach(() => {
                // Override game settings to disable the feature
                game.settings.get.mockImplementation((namespace, setting) => {
                    if (
                        namespace === "dcc-qol" &&
                        setting === "automateNPCDeathStatus"
                    ) {
                        return false; // Feature disabled
                    }
                    return false;
                });
            });

            it("should NOT apply dead status to NPC when feature is disabled", async () => {
                // Arrange
                const updateData = {
                    system: {
                        attributes: {
                            hp: {
                                value: 0, // HP drops to 0
                            },
                        },
                    },
                };
                const options = {};
                const userId = "test-user-id";

                // Act
                await handleNPCDeathStatusUpdate(
                    mockNPC,
                    updateData,
                    options,
                    userId
                );

                // Assert
                expect(socket.executeAsGM).not.toHaveBeenCalled();
            });
        });

        describe("error handling", () => {
            it("should handle errors gracefully when socket call fails", async () => {
                // Arrange
                // Mock console.error
                console.error = jest.fn();
                const error = new Error("Socket call failed");
                socket.executeAsGM.mockRejectedValue(error);

                const updateData = {
                    system: {
                        attributes: {
                            hp: {
                                value: 0,
                            },
                        },
                    },
                };
                const options = {};
                const userId = "test-user-id";

                // Act & Assert - should not throw
                await expect(
                    handleNPCDeathStatusUpdate(
                        mockNPC,
                        updateData,
                        options,
                        userId
                    )
                ).resolves.not.toThrow();

                // Verify error was logged
                expect(console.error).toHaveBeenCalledWith(
                    expect.stringContaining(
                        "Error requesting status application for NPC"
                    ),
                    error
                );
            });

            it("should log warning when socket returns failure result", async () => {
                // Arrange
                // Mock console.warn
                console.warn = jest.fn();
                socket.executeAsGM.mockResolvedValue({
                    success: false,
                    reason: "Status already applied",
                });

                const updateData = {
                    system: {
                        attributes: {
                            hp: {
                                value: 0,
                            },
                        },
                    },
                };
                const options = {};
                const userId = "test-user-id";

                // Act
                await handleNPCDeathStatusUpdate(
                    mockNPC,
                    updateData,
                    options,
                    userId
                );

                // Assert
                expect(socket.executeAsGM).toHaveBeenCalledWith(
                    "gmApplyStatus",
                    mockNPC.uuid,
                    "dead"
                );
                expect(console.warn).toHaveBeenCalledWith(
                    expect.stringContaining(
                        "Failed to apply dead status to NPC Test NPC: Status already applied"
                    )
                );
            });
        });
    });
});
