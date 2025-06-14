/* globals jest, describe, it, expect, beforeEach, afterEach, game, CONFIG, CONST, ChatMessage */

import { createMockNpc } from "../__mocks__/mock-data.js";
import { gmApplyStatus } from "../socketHandlers.js";

// Mock the global fromUuid function
global.fromUuid = jest.fn();

// Mock ChatMessage
global.ChatMessage = {
    create: jest.fn(),
    getSpeaker: jest.fn(),
};

// Mock CONST
global.CONST = {
    CHAT_MESSAGE_TYPES: {
        OTHER: 0,
    },
};

describe("Socket Handlers", () => {
    describe("gmApplyStatus", () => {
        let mockActor;
        let originalConsoleLog, originalConsoleDebug, originalConsoleError;

        beforeEach(() => {
            // Mock console methods to avoid test output noise
            originalConsoleLog = console.log;
            originalConsoleDebug = console.debug;
            originalConsoleError = console.error;
            console.log = jest.fn();
            console.debug = jest.fn();
            console.error = jest.fn();

            // Reset all mocks
            jest.clearAllMocks();

            // Mock game object
            global.game = {
                user: {
                    isGM: true, // Default: user is GM
                },
                i18n: {
                    localize: jest.fn((key) => key), // Simple mock that returns the key
                },
            };

            // Mock CONFIG
            global.CONFIG = {
                statusEffects: [
                    {
                        id: "dead",
                        name: "DCC-QOL.StatusEffect.Dead",
                        label: "Dead",
                    },
                    {
                        id: "stunned",
                        name: "DCC-QOL.StatusEffect.Stunned",
                        label: "Stunned",
                    },
                ],
            };

            // Create mock actor
            mockActor = createMockNpc({
                uuid: "Actor.mock-npc-uuid",
                name: "Test NPC",
                type: "NPC",
                statuses: new Set(), // Empty status set initially
                toggleStatusEffect: jest.fn().mockResolvedValue(true),
            });

            // Mock fromUuid to return our mock actor
            fromUuid.mockResolvedValue(mockActor);

            // Mock ChatMessage.getSpeaker
            ChatMessage.getSpeaker.mockReturnValue({ alias: "Test NPC" });
            ChatMessage.create.mockResolvedValue({});
        });

        afterEach(() => {
            // Restore console methods
            console.log = originalConsoleLog;
            console.debug = originalConsoleDebug;
            console.error = originalConsoleError;
        });

        describe("when user is GM", () => {
            it("should successfully apply status to actor that doesn't have it", async () => {
                // Arrange
                const actorUuid = "Actor.mock-npc-uuid";
                const status = "dead";

                // Act
                const result = await gmApplyStatus(actorUuid, status);

                // Assert
                expect(result).toEqual({ success: true });
                expect(fromUuid).toHaveBeenCalledWith(actorUuid);
                expect(mockActor.toggleStatusEffect).toHaveBeenCalledWith(
                    status
                );
                expect(ChatMessage.create).toHaveBeenCalledWith({
                    speaker: { alias: "Test NPC" },
                    content: "Test NPC is now dcc-qol.statuseffect.dead.",
                });
            });

            it("should successfully apply status in silent mode (no chat message)", async () => {
                // Arrange
                const actorUuid = "Actor.mock-npc-uuid";
                const status = "dead";
                const silent = true;

                // Act
                const result = await gmApplyStatus(actorUuid, status, silent);

                // Assert
                expect(result).toEqual({ success: true });
                expect(mockActor.toggleStatusEffect).toHaveBeenCalledWith(
                    status
                );
                expect(ChatMessage.create).not.toHaveBeenCalled();
            });

            it("should return failure when actor already has the status", async () => {
                // Arrange
                mockActor.statuses.add("dead"); // Actor already has dead status
                const actorUuid = "Actor.mock-npc-uuid";
                const status = "dead";

                // Act
                const result = await gmApplyStatus(actorUuid, status);

                // Assert
                expect(result).toEqual({
                    success: false,
                    reason: "already-has-status",
                });
                expect(mockActor.toggleStatusEffect).not.toHaveBeenCalled();
                expect(ChatMessage.create).not.toHaveBeenCalled();
                expect(console.debug).toHaveBeenCalledWith(
                    "DCC-QOL | Actor Test NPC already has status 'dead'"
                );
            });

            it("should return failure when actor UUID is invalid", async () => {
                // Arrange
                fromUuid.mockResolvedValue(null); // Invalid UUID
                const actorUuid = "Actor.invalid-uuid";
                const status = "dead";

                // Act
                const result = await gmApplyStatus(actorUuid, status);

                // Assert
                expect(result).toEqual({
                    success: false,
                    reason: "no-actor",
                });
                expect(mockActor.toggleStatusEffect).not.toHaveBeenCalled();
                expect(ChatMessage.create).not.toHaveBeenCalled();
            });

            it("should handle toggleStatusEffect errors gracefully", async () => {
                // Arrange
                const error = new Error("Status effect failed");
                mockActor.toggleStatusEffect.mockRejectedValue(error);
                const actorUuid = "Actor.mock-npc-uuid";
                const status = "dead";

                // Act
                const result = await gmApplyStatus(actorUuid, status);

                // Assert
                expect(result).toEqual({
                    success: false,
                    reason: "Status effect failed",
                });
                expect(console.error).toHaveBeenCalledWith(
                    "DCC-QOL | Error applying status: dead to NPC Test NPC:",
                    error
                );
            });

            it("should fall back to status ID when no config found", async () => {
                // Arrange
                const actorUuid = "Actor.mock-npc-uuid";
                const status = "unknown-status"; // Not in CONFIG.statusEffects

                // Act
                const result = await gmApplyStatus(actorUuid, status);

                // Assert
                expect(result).toEqual({ success: true });
                expect(ChatMessage.create).toHaveBeenCalledWith({
                    speaker: { alias: "Test NPC" },
                    content: "Test NPC is now unknown-status.",
                });
            });

            it("should handle actor with undefined statuses", async () => {
                // Arrange
                mockActor.statuses = undefined; // No statuses property
                const actorUuid = "Actor.mock-npc-uuid";
                const status = "dead";

                // Act
                const result = await gmApplyStatus(actorUuid, status);

                // Assert
                expect(result).toEqual({ success: true });
                expect(mockActor.toggleStatusEffect).toHaveBeenCalledWith(
                    status
                );
            });
        });

        describe("when user is not GM", () => {
            beforeEach(() => {
                game.user.isGM = false;
            });

            it("should return failure when user is not GM", async () => {
                // Arrange
                const actorUuid = "Actor.mock-npc-uuid";
                const status = "dead";

                // Act
                const result = await gmApplyStatus(actorUuid, status);

                // Assert
                expect(result).toEqual({
                    success: false,
                    reason: "not-gm",
                });
                expect(fromUuid).not.toHaveBeenCalled();
                expect(mockActor.toggleStatusEffect).not.toHaveBeenCalled();
                expect(ChatMessage.create).not.toHaveBeenCalled();
            });
        });
    });
});
