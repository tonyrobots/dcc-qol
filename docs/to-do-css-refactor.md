# CSS Refactor Plan for DCC-QoL - Implementation Guide

This document provides the implementation roadmap for refactoring DCC-QoL's CSS to support Foundry VTT v13's theming system with automatic light/dark mode switching.

## Quick Reference

**SCSS Build System:** ✅ **COMPLETE**

-   Uses `sass ^1.69.3` matching DCC system
-   Build: `npm run scss` | Watch: `npm run scss-watch`
-   File structure established with modular SCSS files

**Key Implementation Requirements:**

-   Inherit DCC system background via `--system-frame-background`
-   Preserve 5 button color themes (damage=green, crit=orange, fumble=red, friendly-fire=yellow, friendly-fire-damage=brown)
-   Maintain compact vs. full chat card variants
-   Support status color system (success/failure/warning)
-   Use CSS layers (automatic `modules` layer via `module.json`)

## Current File Structure

```
styles/
├── dcc-qol.scss          # ✅ Main entry point
├── _variables.scss       # ✅ CSS custom properties
├── _utilities.scss       # ✅ Utility classes
├── _chat-cards.scss      # ✅ Chat card components
├── _buttons.scss         # ✅ Button system
├── dcc-qol.css          # ✅ Compiled output
├── dcc-qol.css.map      # ✅ Source map
└── legacy/              # ✅ Preserved originals
    ├── dcc-qol.css
    └── dcc-qol_old.css
```

## Component Requirements Summary

### Chat Cards

#### Base Chat Card (`.dccqol.chat-card`)

-   **Background**: Currently `#e0dbd0` (parchment) - **WILL INHERIT FROM DCC SYSTEM**
-   **Border**: `1px solid #782e22` - **WILL USE DCC SYSTEM BORDER COLOR**
-   **Typography**: `Signika, sans-serif` 13px - **WILL INHERIT FROM DCC SYSTEM**
-   **Header**: Flex layout with 36px images, no bottom border
-   **Content Area**: 5px padding, status colors for results
-   **Footer**: Optional border-top, centered content

#### Compact Chat Card (`.dccqol.chat-card.compact`)

-   **Images**: Reduced to 24px in compact header
-   **Button Layout**: CSS Grid system for button arrangement
-   **Spacing**: Tighter padding throughout
-   **Dice Display**: Inline dice formulas and totals
-   **Grid Buttons**: `.compact-buttons-grid` with responsive single/multi-child layouts

#### Specialized Components

-   **Weapon Description** (`.weapon-description`): Collapsible `<details>` with light border
-   **Debug Information** (`.attack-debug-details`): Collapsible debug info, muted colors
-   **Friendly Fire Warning** (`.friendly-fire-warning`): Orange-tinted warning box

### Button System (5 Types + States)

#### Button Types & Colors

-   **Damage** (`data-action="damage"`) - **Green theme** (`#28a745` base)
-   **Critical** (`data-action="crit"`) - **Orange theme** (`#fd7e14` base)
-   **Fumble** (`data-action="fumble"`) - **Red theme** (`#dc3545` base)
-   **Friendly Fire** (`data-action="friendlyFire"`) - **Yellow/Amber theme** (`#ffc107` base)
-   **Friendly Fire Damage** (`data-action="friendlyFireDamage"`) - **Brown theme** (`#8b4513` base)

#### Button States & Effects

-   **Default**: Gradient backgrounds with border shadows, 6px-12px padding
-   **Hover**: Lighter gradients with `translateY(-1px)` transform effect
-   **Active**: Pressed state with inset shadow
-   **Disabled**: Grayscale filter, opacity 0.6, `pointer-events: none`

#### Button Layout Patterns

-   **Full Cards**: Full-width buttons with 2px margin
-   **Compact Cards**: CSS Grid layout (`.compact-buttons-grid`)
-   **Single Button**: Special `:only-child` styling for single buttons

### Status Colors & Applications

#### Core Status Classes

-   `.status-success` - **Green (#18520b)** - Hits, successful actions, critical dice
-   `.status-failure` - **Red (#810c0a)** - Misses, failures, fumble dice
-   `.status-warning` - **Orange (#aa5502)** - Warnings, friendly fire alerts

#### Status Applications

-   **Attack Results**: Applied to `.attack-status` elements
-   **Dice Totals**: `.dice-total.critical` and `.dice-total.fumble`
-   **Roll Results**: General `.roll-result` with status classes
-   **System Cards**: `.dccqol-system-card-font` elements

### DCC System Variables Available

-   `--system-frame-background` - Card backgrounds (auto light/dark)
-   `--system-border-color` - Borders
-   `--system-primary-color` - Main text
-   `--system-label-font` - Button text
-   `--system-data-font` - Content text

## Legacy CSS Analysis (For Reference)

### Current Implementation Characteristics

-   **615 lines** of CSS in production file
-   **Heavy use of `!important`** declarations (maintenance concern)
-   **Hardcoded color values** throughout (theming limitation)
-   **No CSS custom properties** (prevents theming)
-   **Duplicate styling** between compact and full variants
-   **Complex gradient buttons** with multiple states
-   **Specialized dice roll overrides** for Foundry defaults

### Key Patterns to Preserve

-   **Gradient button system** with hover transforms
-   **Flex header layout** with image + title
-   **Collapsible sections** using `<details>` elements
-   **CSS Grid compact layout** for responsive buttons
-   **Status color integration** across multiple components
-   **Dice styling overrides** for critical/fumble indication

### Inheritance Opportunities

-   **Typography**: Can inherit from DCC's `--system-data-font` and `--system-label-font`
-   **Backgrounds**: Replace `#e0dbd0` with `--system-frame-background`
-   **Borders**: Replace `#782e22` with `--system-border-color`
-   **Grid Systems**: Can leverage DCC's grid utilities where applicable
-   **Spacing**: Can use DCC's margin/padding utilities

## Implementation Phases

### Phase 2: Architecture Design ✅ **COMPLETE**

#### Step 2.1: File Structure Design ✅ **COMPLETE**

#### Step 2.2: CSS Custom Properties Strategy ✅ **COMPLETE**

-   [x] **First**: Use existing DCC variables where possible (e.g., `--system-primary-color`, `--system-border-color`)
-   [x] **Second**: Create DCC-QoL specific variables only for unique needs (e.g., `--dcc-qol-crit-color`, `--dcc-qol-fumble-color`)
-   [x] Follow DCC's naming pattern: `--dcc-qol-{component}-{property}`
-   [x] Use DCC's theming pattern: define in `:root`, override in `.theme-dark`

**Implementation Summary:**

-   **Inherited Variables**: 5 core DCC system variables for backgrounds, borders, text, and fonts
-   **Status Colors**: 4 semantic colors (success, failure, warning, info) for QoL functionality
-   **Button System**: Complete 5-action button theming with hover/active states and gradients
-   **Layout Properties**: Spacing system, borders, and component-specific styling
-   **Dark Theme**: Comprehensive dark mode overrides following DCC patterns
-   **Total Variables**: 24 essential custom properties focused on core QoL functionality

#### Step 2.3: Component Architecture ✅ **COMPLETE**

-   [x] Design modular component system for chat cards, buttons, etc.
-   [x] Plan for compact vs. full chat card variants
-   [x] Design button system with consistent theming across action types
-   [x] Plan dice roll styling that integrates with Foundry's global dice styles

**Component Architecture Design:**

**1. Chat Card Component System**

```scss
// Base Chat Card (.dccqol.chat-card)
// - Inherits DCC system background via CSS layers
// - Uses --dcc-qol-chat-* variables for theming
// - Modular header, content, footer structure
// - Responsive layout with flexbox

// Variants:
// - .compact: Reduced spacing, smaller images (24px vs 36px)
// - .friendly-fire-card: Special left border, warning styling
// - Size-responsive: Automatic scaling based on content
```

**2. Button System Architecture (5 Action Types)**

```scss
// Base Pattern: .dccqol-button[data-action="type"]
// - damage: Green theme with gradients
// - crit: Orange theme with gradients
// - fumble: Red theme with gradients
// - friendlyFire: Yellow/amber theme with gradients
// - friendlyFireDamage: Brown theme with gradients

// Button States:
// - :hover: Lighter gradients + translateY(-1px)
// - :active: Inset shadows + pressed effect
// - :disabled: Grayscale + opacity 0.6
// - .compact-button: Grid-based layout variant
```

**3. Layout System Integration**

```scss
// Grid System for Compact Cards:
// - .compact-buttons-grid: CSS Grid for button arrangement
// - :only-child: Special styling for single buttons
// - Responsive: Auto-adjusts to button count

// Flexbox System for Full Cards:
// - .card-buttons: Flex container for full-width buttons
// - .centered: Utility class for center alignment
// - Wrapping: Automatic button wrapping on smaller screens
```

**4. Dice Roll Component Integration**

```scss
// Foundry Integration Pattern:
// - Inherit .dice-roll, .dice-formula, .dice-total from core
// - Override colors: .dice-total.critical, .dice-total.fumble
// - Status integration: .status-success, .status-failure, .status-warning
// - Background consistency: Uses --dcc-qol-dice-background
```

**5. Status & Result Components**

```scss
// Status Classes (Applied via HTML):
// - .status-success: Green text for hits, success states
// - .status-failure: Red text for misses, failures
// - .status-warning: Orange text for warnings, friendly fire
// - .status-info: Blue text for informational content

// Result Containers:
// - .roll-result: Styled result text with status colors
// - .attack-status: Centered attack outcome display
// - .chat-details: Container for result information
```

**6. Template Component Integration**

```handlebars
<!-- Component Usage Pattern -->
{{> "partials/_damage-button.html" compact=true}}
{{> "partials/_crit-button.html" compact=false}}
{{> "partials/_friendly-fire-button.html"}}

<!-- Conditional Rendering -->
{{#if compact}}
  <button class="compact-button" data-action="{{action}}">
{{else}}
  <div class="card-buttons">
    <button data-action="{{action}}">
{{/if}}
```

**7. Responsive Design Patterns**

```scss
// Breakpoint Strategy:
// - No fixed breakpoints (module works in chat sidebar)
// - Container-based responsive design
// - Flex/Grid automatic sizing
// - Compact mode for space-constrained layouts

// Image Sizing:
// - Full cards: 36px images
// - Compact cards: 24px images
// - Backstab icons: 20px (full) / 16px (compact)
```

**8. CSS Layer Integration**

```scss
// Foundry v13 CSS Layers:
// - Module CSS automatically in 'modules' layer via module.json
// - Inherits from 'base' layer (DCC system styles)
// - Overrides specific to QoL functionality only
// - No conflicts with core Foundry or DCC system styles
```

**Implementation Requirements:**

-   **Modularity**: Each component self-contained with clear dependencies
-   **Inheritance**: Leverages DCC system variables where possible
-   **Theming**: Full light/dark mode support via CSS custom properties
-   **Accessibility**: Proper contrast ratios, focus states, screen reader support
-   **Performance**: Minimal CSS specificity, efficient selectors
-   **Maintainability**: Clear naming conventions, documented component interfaces

## ✅ **Phase 2 Complete: Minimal Architecture**

**Summary of Simplification:**

-   **SCSS Files**: Reduced from projected 600+ lines to **530 SCSS lines**
-   **CSS Variables**: Reduced from 60+ to **24 essential variables**
-   **Approach**: "Start from nothing, add as needed" philosophy
-   **Focus**: Only core QoL functionality (5 button types, 4 status colors, basic cards)

**What We Kept:**

-   5 Action Button Types (damage, crit, fumble, friendly-fire, friendly-fire-damage)
-   4 Status Colors (success, failure, warning, info)
-   Basic chat card structure with DCC system inheritance
-   Compact variant layout
-   Dark theme support
-   Legacy compatibility

**What We Eliminated:**

-   Excessive spacing variable systems
-   Intermediate DCC wrapper variables
-   Granular element-level styling
-   Over-engineered component architecture
-   Unnecessary shadow/effect variables

**Next Steps**: Implement as needed during development.

## ✅ **Phase 3: Implementation Complete** (Testing Required)

**Summary of Implementation:**

-   **CSS Variables**: 24 essential variables implemented with light/dark theme structure
-   **SCSS Structure**: Modular architecture with 4 focused files (`_variables.scss`, `_utilities.scss`, `_chat-cards.scss`, `_buttons.scss`)
-   **Compiled Output**: **631 lines of CSS** (comparable to legacy 615 lines)
-   **Button System**: 5-action button theming with hover/active states and gradients implemented
-   **Chat Cards**: Implementation includes compact variants, weapon descriptions, debug info, friendly fire warnings
-   **Dice Integration**: Global dice styling overrides with QoL-specific enhancements implemented
-   **DCC Inheritance**: Uses `--system-frame-background`, `--system-border-color`, `--system-primary-color`, `--system-data-font`, `--system-label-font`
-   **Status System**: 4 semantic status colors (success, failure, warning, info) implemented
-   **Legacy Compatibility**: Preserved `.dccqol-button` classes for backward compatibility

**Key Architectural Achievements:**

-   **Minimal Approach**: Followed "start from nothing, add as needed" philosophy
-   **Direct Inheritance**: Uses DCC system variables directly rather than wrapper variables
-   **Hardcoded Simplicity**: Simple values (5px, 3px) instead of complex spacing systems
-   **Component Focus**: Focused on 5 button action types + 4 status colors only
-   **Responsive Design**: Compact variant as main layout difference with CSS Grid button system

**Build System Status:** ✅ **Functional**

-   SCSS compilation: `npm run scss` working correctly
-   Source maps: Generated for debugging support
-   Watch mode: `npm run scss-watch` available for development

**⚠️ TESTING REQUIRED:** All functionality has been implemented but requires testing to verify:

-   Theme switching in Foundry
-   DCC system variable inheritance
-   Button interactions and states
-   Chat card rendering in both themes
-   Dice roll integration
-   Status color applications

### Phase 3: Implementation

#### Step 3.1: Core Variables and Theming Foundation ✅ **IMPLEMENTED**

-   [x] Create `_variables.scss` with CSS custom properties
-   [x] Implement light theme as default
-   [x] Implement dark theme overrides using `.theme-dark` selector
-   [ ] Test theme switching functionality
-   [ ] Ensure proper inheritance from DCC system variables

#### Step 3.2: Base Styles and Utilities ✅ **IMPLEMENTED**

-   [x] Implement base chat card structure in `_chat-cards.scss`
-   [x] Create utility classes in `_utilities.scss` (`.centered`, `.status-success`, etc.)
-   [x] Implement foundational typography and spacing systems
-   [ ] Test integration with Foundry's CSS layers

#### Step 3.3: Chat Card Components ✅ **IMPLEMENTED**

-   [x] Implement main chat card styling in `_chat-cards.scss`
-   [x] Create compact chat card variant
-   [x] Implement weapon description sections
-   [x] Add friendly fire warning styling
-   [x] Create debug information styling
-   [ ] Test all chat card variants in both themes

#### Step 3.4: Button System ✅ **IMPLEMENTED**

-   [x] Implement base button styling in `_buttons.scss`
-   [x] Create themed button variants (damage, crit, fumble, friendly fire)
-   [x] Implement disabled button states
-   [x] Add hover and active states with theme support
-   [ ] Test button system across all use cases

#### Step 3.5: Dice Roll Integration ✅ **IMPLEMENTED**

-   [x] Implement dice roll styling
-   [x] Ensure integration with Foundry's global dice styles
-   [x] Add QoL-specific enhancements (crit/fumble colors)
-   [ ] Test with various dice roll types and formulas

#### Step 3.6: Status and Feedback Systems ✅ **IMPLEMENTED**

-   [x] Implement status colors
-   [x] Create damage application feedback styling
-   [x] Add friendly fire result styling
-   [x] Implement attack result indicators
-   [ ] Test all status states in both themes

### Phase 4: Integration and Testing

#### Step 4.1: DCC System Integration

-   [ ] Test inheritance from DCC system styles
-   [ ] Verify no conflicts with DCC system CSS
-   [ ] Ensure QoL styles don't interfere with DCC sheets
-   [ ] Test with various DCC system themes/customizations

#### Step 4.2: Foundry CSS Layer Integration

-   [ ] Configure proper CSS layer placement in `module.json`
-   [ ] Test style precedence with core Foundry styles
-   [ ] Verify compatibility with other modules
-   [ ] Test layer inheritance and override behavior

#### Step 4.3: Theme Switching Testing

-   [ ] Test automatic theme detection based on OS/browser settings
-   [ ] Test world-level theme overrides
-   [ ] Verify theme switching doesn't break any components
-   [ ] Test with various Foundry UI scaling settings

#### Step 4.4: Cross-Browser Testing

-   [ ] Test in Chrome, Firefox, Safari, Edge
-   [ ] Verify CSS custom property support
-   [ ] Test CSS layer support across browsers
-   [ ] Validate SCSS compilation output

### Phase 5: Migration and Cleanup

#### Step 5.1: Replace Current CSS

-   [ ] Update `module.json` to reference new CSS files
-   [ ] Verify legacy CSS files are preserved in `styles/legacy/` directory
-   [ ] Update any hardcoded style references in JavaScript
-   [ ] Test full module functionality with new CSS

#### Step 5.2: Documentation Update

-   [ ] Update CSS structure guide documentation
-   [ ] Document new theming variables for future developers
-   [ ] Create guide for customizing QoL themes
-   [ ] Update project structure documentation

#### Step 5.3: Performance Optimization

-   [ ] Minimize CSS output size
-   [ ] Remove unused styles and variables
-   [ ] Optimize CSS custom property usage
-   [ ] Test performance impact vs. current implementation

## Technical Reference

### Variable Naming Convention

```scss
// Base pattern: --dcc-qol-{component}-{property}-{variant}
--dcc-qol-chat-background: var(--system-frame-background);
--dcc-qol-chat-border: var(--system-border-color);
--dcc-qol-status-success: #18520b;
--dcc-qol-status-failure: #810c0a;
--dcc-qol-status-warning: #aa5502;
```

### Theme Implementation Pattern

```scss
:root {
    // Light theme defaults
    --dcc-qol-crit-color: #fd7e14;
    --dcc-qol-fumble-color: #dc3545;
}

.theme-dark {
    // Dark theme overrides
    --dcc-qol-crit-color: #ff8c42;
    --dcc-qol-fumble-color: #ff6b6b;
}
```

### Build Commands

```bash
npm run scss        # Compile SCSS to CSS
npm run scss-watch  # Watch for changes and auto-compile
```

### Module Configuration

```json
{
    "styles": ["styles/dcc-qol.css"]
}
```

## Success Criteria

-   [ ] Complete removal of old CSS system
-   [ ] Full light/dark theme support with automatic switching
-   [ ] Proper integration with Foundry v13 CSS layers
-   [ ] No visual regressions from current implementation
-   [ ] Improved maintainability through SCSS structure
-   [ ] Better performance through optimized CSS
