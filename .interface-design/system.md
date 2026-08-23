# Lophos interface system

## Direction and feel

- Calm, editorial product interface built for scanning, reading, and organizing news.
- Preserve the existing warm neutral palette, Outfit typography, restrained borders, and compact interaction density.
- Prefer quiet structural consistency over decorative styling.

## Depth and surfaces

- Use subtle borders and small shadows already defined in `src/app/globals.css`.
- Keep elevated menus visually distinct from their parent surface without introducing stronger colors.
- Do not mix additional depth strategies unless a component requires a true overlay, such as a modal or dropdown.

## Spacing

- Follow the existing quarter-rem spacing rhythm where practical.
- Preserve component-specific compact insets when they are already established.

## Nested border radii

- For visibly nested rounded surfaces, calculate the inner radius from the actual inset: `inner radius = outer radius - inset`.
- Store the outer radius and inset as local custom properties when a component has multiple nested parts.
- Apply this to surfaces such as dropdown options inside a padded menu and the active pill inside a segmented control.
- Do not apply the formula to ordinary inputs, buttons, chips, avatars, or unrelated controls merely because they sit inside a card; those retain their component-category radius.
- Media clipped by a parent with `overflow: hidden` should fill the parent and inherit its visible outer geometry instead of adding a competing inner radius.

## Reusable patterns

- Settings buttons use the existing pill geometry and subtle `0.95` active scale; explicitly stronger legacy reactions may keep `0.85`.
- Scrollable editorial inspector pages use a directional `mask-image` fade only while more content exists beyond the visible edge.
- Mosaic headings use balanced wrapping; mosaic body copy uses pretty wrapping.
- Public editorial-list cards reuse `EditorialListCardReactions` in both mosaic and list views; `/lists` receives the initial reaction map from the server, then persists optimistic changes without removing entries from the complete catalog.
