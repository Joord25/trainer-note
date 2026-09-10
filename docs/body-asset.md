# Body atlas asset

Generated via built-in imagegen on 2026-09-10, integrated as public/images/body-atlas.png.
This is a stylized 3D-rendered body navigation image, not a rotatable 3D model, an individual member body scan, or a diagnostic anatomical illustration. Percentages and interactive selections are rendered separately from the bitmap.

Prompt:
Use case: stylized-concept. Transparent cutout for a premium trainer workout app body-map. ONE image containing front and back views side-by-side of the same neutral nonsexual gender-neutral athletic anatomical mannequin. Genuinely transparent background with alpha, no backdrop, no floor, no cast shadow outside subjects. Anatomically plausible stylized athletic mannequin, smooth neutral face, satin pearl and pale stone material with subtle muted sage accents following major muscle groups. Refined understated anatomy; not a medical dissection. No exposed organs, no genital detail. Sophisticated high-end 3D studio render, soft controlled studio lighting, matte satin material, elegant premium wellness aesthetic. Landscape 3:2, front centered at x25%, back at x75%, full bodies head to feet, generous transparent whitespace, clear gap. Consistent orthographic scale and alignment. Neutral A pose, arms slightly away from torso, legs comfortably apart, feet fully visible. Same body/material front and back. Only two mannequin views; no text, labels, numbers, UI, logos, watermark, extra objects. Preserve actual alpha transparency, never a checkerboard drawn into the image.

## Softer revision

Active asset: `public/images/body-atlas-soft.png`, edited with built-in imagegen. Replaced realistic face and muscle fibers with a smooth faceless pearl/sage mannequin. Flat pale background, no transparency. Original retained for history.

Edit prompt: Keep front/back figure positions and poses. Replace realistic anatomical appearance with a softly rounded minimalist 3D mannequin. Featureless oval heads, no eyes/nose/mouth, no muscle fibers, veins or tendons. Smooth pearl and sage bodysuit-like surfaces, simplified hands and feet, low contrast diffuse lighting, no metallic shine, no text.

Final background correction prompt: Keep the two smooth faceless mannequin figures exactly as they are, in the same positions and poses with the same pearl and sage colors. Only replace the ENTIRE checkerboard/textured background with a perfectly uniform solid very pale greenish white #f3f6f1 background. No checkerboard anywhere, no wrinkles, no texture, no vignette, no shadow on the backdrop, no gradient. Do NOT make this image transparent. The output should be a clean matte fitness-app asset on a completely flat pale background. Preserve both full-body faceless figures, framing and 3:2 dimensions. No text.

## Kenko pictogram integration

Replaced the mannequin/pin UI with five selectable pictogram rows (chest, back,
shoulders, legs, core). Assets reused from ohunjal-ai/public/icons/body with the
existing green highlights preserved. Figma source: Kenko UI Kit, Symbols,
icons / body (leg-press node 0:3823).

The pictograms identify regions; percentages, sets, class counts, exercise names,
and source links use the selected period's existing summary data. A leg-press
pictogram represents the demo's squat group, not every lower-body muscle. These
are static SVG icons, not a body-shape or recovery simulation.

## Full body region view

Expanded the cropped Kenko SVGs into front/back body views using their original
vector paths. `body-vectors.ts` stores only trusted path geometry; icon masks and
backgrounds are omitted. Front chest/shoulder paths share the same coordinate
system; core paths are offset +6 and leg paths +42 to match. The two arm paths
included in the core icon are excluded from the abdominal highlight.

Direct labels show part name, percentage and sets. Both regions and labels are
keyboard-selectable and update the existing evidence detail. Front/back switching
keeps the selected region visible. Colors identify regions, not recovery or risk.

## Arm regions

Added biceps on the front and triceps on the back. Reused Kenko barbell-curl
paths with +6 vertical alignment and triceps arm-only paths with +1 alignment.
The two back-highlight paths from the triceps source are excluded. Arm labels
use the free left-side space between chest and lower-body labels.

Recognized direct arm exercises have separate set totals and source links.
Combined biceps/triceps names remain unclassified. Existing demo records contain
no direct arm work, so arms display 0% without inventing new workout records.

## Outline and interaction cleanup

Split the drawing into a neutral silhouette, interaction-only region fills,
retained interior lines and a final dark outer contour. Removed forearm
subdivisions and tiny duplicate stroke fragments on both views. Region overlays
no longer add white or duplicate outlines. Original geometry remains available.

No region is selected initially. Hovering or focusing either a body region or
its text label highlights the same geometry; clicking keeps the choice and opens
its source detail. Temporary hover takes precedence and falls back to the
focused or selected region on exit. Switching views clears the selection.
Zero-set regions can still be highlighted without changing their recorded value.
