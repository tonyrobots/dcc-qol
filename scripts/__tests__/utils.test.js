/* globals jest, describe, it, expect, game */

import { getTokenById } from "../utils.js";

describe("Utility Functions", () => {
    describe("getTokenById", () => {
        it("should return a token document when a valid ID is provided", () => {
            // Arrange
            const fakeTokenId = "90210";
            const fakeTokenDocument = { id: fakeTokenId, name: "Test Token" };
            game.canvas.tokens.get.mockReturnValue({
                document: fakeTokenDocument,
            });

            // Act
            const result = getTokenById(fakeTokenId);

            // Assert
            expect(result).toBe(fakeTokenDocument);
            expect(game.canvas.tokens.get).toHaveBeenCalledWith(fakeTokenId);
        });

        it("should return null if the token is not found", () => {
            // Arrange
            const fakeTokenId = "nonexistent";
            game.canvas.tokens.get.mockReturnValue(null);

            // Act
            const result = getTokenById(fakeTokenId);

            // Assert
            expect(result).toBeNull();
            expect(game.canvas.tokens.get).toHaveBeenCalledWith(fakeTokenId);
        });
    });
});
