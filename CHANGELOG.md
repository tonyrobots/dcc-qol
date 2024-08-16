# Changelog

## 0.0.24 - 2024-08-16

**Deed Die Damage Fix**
This is a quick fix to automated Deed Die handling. It addresses an issue whereby the deed die would be automatically rolled with the attack roll, but it wasn't updating on the attacker's character sheet, and therefore wasn't being applied correctly when rolling damage.

## 0.0.23 - 2024-07-07

Small update to add compatibility for Foundry v12/DCC system v0.42

Note: DCC support for v12 is still new, and this update hasn't been comprehensively tested, so there here may still be some bugs. Proceed with caution!

**Full Changelog**: https://github.com/tonyrobots/dcc-qol/compare/0.0.22...0.0.23

## v0.0.22 - 2024-04-22

Quick follow-up to yesterday's release -- this release fixes the bug in the way the distance between two tokens was being determined, as used in all of the range-specific functionality. Previously, it wasn't working for tokens bigger than 1x1 grid square -- the distance was being calculated based on the top left tile, instead of taking into account the full size of the token/actor.

Full list of changes:

### Fixed

- fixed distance calculation function to account for tokens larger than 1x1
- clarified the copy for the range checking option to better reflect what it actually does
- clarified the messaging for "out of range" warnings for both melee and ranged attacks
- adjusted range checking for melee and ranged attacks so it only happens if the relevant option is enabled

### Removed

- removed option that prevented backstabs from weapons that don't have bonus backstab damage, as it was based on incorrect interpretation of the rules

### Added

- added CI function to automatically publish new versions to Foundry website

## v0.0.21 - 2024-04-21

Hi all! A relatively small update, but my first of any substance since taking over the module. Mostly focused on the "Friendly Fire" functionality, which handles the determination of whether to apply an attack roll penalty for ranged attacks into a melee, and the chance those attacks might accidentally strike an ally. Also just started to tidy up some options, and other text for clarity. Specifically:

### Fixed

- Fixed Friendly Fire determination bug, that caused false positives if any token was adjacent to your target (not just friendlies)
- Cleaned up some of the language for clarity

### Added

- Added separate option for enabling/disabling the -1 penalty for ranged weapon attacks fired into melee

### Removed

- Remove setting for "manual damage" reminder for users who have auto-damage turned off. (Reminder is just present by default.)

### Changed

- Module will notify if melee attack is from beyond melee range, but will no longer prevent the attack roll from happening. (This is a workaround for a bug I spotted in range determination for targets that are larger than 1 grid square; to be fixed on a subsequent release.)

## v0.0.20 - 2024-04-06

### Changed

- Transition of maintenance from sasquach to tonyrobots. Hello, dungeon crawlers!
