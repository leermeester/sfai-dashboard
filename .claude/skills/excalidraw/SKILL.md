---
name: excalidraw
description: "Create professional, CEO-presentable diagrams using the Excalidraw MCP. Use when asked to draw, diagram, visualize, sketch, or create any visual artifact. Supports named templates (funnel, architecture, business model canvas, etc.) and freeform generation from descriptions. Auto-exports to excalidraw.com for sharing."
argument-hint: "[template-name or description]"
---

# Excalidraw — Professional Diagram Generator

Create clean, polished, executive-grade diagrams suitable for CEO presentations, board meetings, and stakeholder communication. Every diagram is automatically exported to excalidraw.com with a shareable link.

> **First time?** See [SETUP.md](SETUP.md) for how to connect the Excalidraw MCP server (VS Code, Claude Desktop, or self-hosted).

## Invocation

```
/excalidraw                                → Ask what to diagram
/excalidraw funnel                         → Use funnel template
/excalidraw business model canvas          → Use BMC template
/excalidraw "our authentication system"    → Freeform from description
```

After a diagram exists, the user can iterate:
```
"add a feedback loop between Sales and Product"
"remove the marketing node"
"change the title to Q3 Strategy"
```

## Execution Flow

### Step 1: Understand the Request
- Parse the argument for a template name or freeform description
- If no argument, ask what the user wants to diagram

### Step 2: Ask Clarifying Questions (use AskUserQuestion)
Always ask these before generating:
1. **Maximum elements**: "How many elements max? (I recommend 7-9 for executive readability)" — suggest a default based on template type
2. **Key entities**: "What are the main nodes/stages/actors?" — only ask for freeform requests, not templates where the user provides content inline
3. **Diagram type**: Only ask if not obvious from the request

For templates, ask for the content to fill each section (e.g., for BMC: "What are your Key Partners, Key Activities, Value Proposition..." etc.)

### Step 3: Generate the Diagram
- Call `mcp__excalidraw__create_view` with the elements JSON array
- Follow ALL style rules below precisely
- Use progressive camera animations for diagrams with 5+ elements
- Always show complete diagram with a final zoom-out camera at the end

### Step 4: Auto-Export
- ALWAYS call `mcp__excalidraw__export_to_excalidraw` immediately after rendering
- Present the shareable link to the user
- Save checkpoint via `mcp__excalidraw__save_checkpoint` for future iteration

### Step 5: Iterate (if user requests changes)
- Call `mcp__excalidraw__read_checkpoint` to restore previous state
- Use `restoreCheckpoint` as first element + `delete` pseudo-elements for removals
- Add new elements with FRESH IDs (never reuse deleted IDs)
- Re-export and save new checkpoint

---

## Style Rules (MANDATORY)

These rules produce clean, polished, McKinsey-quality diagrams. Follow them exactly.

### Shape Styling
- `roughness: 0` on ALL elements (sharp edges, no hand-drawn wobble)
- `roundness: { "type": 3 }` on ALL rectangles (smooth rounded corners)
- `strokeWidth: 2` for primary elements
- `strokeWidth: 1` for secondary elements, background zones, and subtle borders
- `fillStyle: "solid"` for all filled shapes

### Typography
- Minimum `fontSize: 16` for all body text and labels
- Minimum `fontSize: 20` for section headings
- Minimum `fontSize: 24` for diagram titles
- NEVER use `fontSize` below 14 for any element
- For XL/XXL camera sizes, increase minimum to 18/21 respectively

### Consistent Box Sizing
- **Same-level elements MUST have identical dimensions** (e.g., all process steps = 180x80, all actors = 140x60)
- If text is too long for the standard box: **shorten the text first** (abbreviate, use acronyms, remove filler words)
- Only increase box size as an absolute last resort
- Minimum shape size: 140x60 for labeled rectangles

### Text Inside Shapes (CRITICAL — labels don't render reliably)

**DO NOT use the `label` property on shapes.** It frequently fails to render, producing empty boxes.

**ALWAYS use standalone text elements** positioned inside the shape:

```json
// WRONG — label often doesn't render:
{"type":"rectangle","id":"r1","x":100,"y":100,"width":200,"height":70,
 "label":{"text":"My Label","fontSize":16}}

// CORRECT — standalone text always renders:
{"type":"rectangle","id":"r1","x":100,"y":100,"width":200,"height":70,
 "backgroundColor":"#a5d8ff","fillStyle":"solid","roughness":0,
 "roundness":{"type":3},"strokeColor":"#4a9eed","strokeWidth":2},
{"type":"text","id":"r1-t","x":140,"y":128,"text":"My Label",
 "fontSize":16,"strokeColor":"#1e1e1e"}
```

**How to center text inside a box:**
- `text_x = box_x + (box_width / 2) - (text_length * fontSize * 0.3)`
- `text_y = box_y + (box_height / 2) - (fontSize / 2)`
- For two lines: place line 1 at `center_y - fontSize`, line 2 at `center_y + 2`
- Use `#1e1e1e` for primary text, `#757575` for secondary/subtitle text

**ALWAYS emit the text element immediately after its parent shape** (shape → text → arrows → next shape).

### Spacing & Alignment
- Minimum 30px gap between all elements
- Align elements on a consistent grid (same Y for horizontal flows, same X for vertical flows)
- Center-align groups of related elements
- Text must NEVER overlap adjacent elements or other text

### Color Usage
- Maximum 3-4 fill colors per diagram
- Use semantic color meaning consistently within a diagram
- Background zones use `opacity: 30` for grouping without visual clutter
- All text on white backgrounds must be `#1e1e1e` or darker (never light gray)
- For text on colored fills, use dark variants of the fill color

### Color Palette Reference

**Shape fills (light backgrounds):**
| Color | Hex | Semantic Use |
|-------|-----|-------------|
| Light Blue | `#a5d8ff` | Inputs, sources, primary nodes |
| Light Green | `#b2f2bb` | Outputs, success, completed |
| Light Orange | `#ffd8a8` | External, pending, warnings |
| Light Purple | `#d0bfff` | Processing, middleware, special |
| Light Red | `#ffc9c9` | Errors, critical, blockers |
| Light Yellow | `#fff3bf` | Decisions, notes, highlights |
| Light Teal | `#c3fae8` | Storage, data, infrastructure |
| Light Pink | `#eebefa` | Analytics, metrics, KPIs |

**Stroke & accent colors:**
| Color | Hex | Use |
|-------|-----|-----|
| Blue | `#4a9eed` | Primary connections, key flows |
| Green | `#22c55e` | Success paths, positive flows |
| Amber | `#f59e0b` | Decision points, warnings |
| Purple | `#8b5cf6` | Special processes, transforms |
| Red | `#ef4444` | Error paths, critical items |
| Cyan | `#06b6d4` | Information, secondary flows |

**Background zones (opacity: 30):**
| Color | Hex | Use |
|-------|-----|-----|
| Blue zone | `#dbe4ff` | Frontend / UI layer |
| Purple zone | `#e5dbff` | Logic / processing layer |
| Green zone | `#d3f9d8` | Data / infrastructure layer |

### Camera & Animation Rules
- ALWAYS start with a `cameraUpdate` as the FIRST element
- Use 4:3 aspect ratio ONLY: 400x300, 600x450, 800x600, 1200x900, 1600x1200
- **Simple diagrams (1-4 elements)**: Single camera, show complete
- **Standard diagrams (5-9 elements)**: Start zoomed in on title/first section, zoom out to reveal full diagram
- **Complex diagrams (10+ elements)**: Progressive camera panning section by section, final zoom-out at end
- Leave padding: content should not fill the entire camera viewport (e.g., 500px content in 800x600 camera)

### Drawing Order (CRITICAL)
Emit elements progressively for streaming animation:
- Background zones FIRST
- Then: shape → its label → its arrows → next shape
- Titles and annotations LAST (or first if zooming in on title)
- NEVER: all rectangles → all texts → all arrows

---

## Named Templates

### Business & Strategy

#### `business-model-canvas`
9-block Business Model Canvas layout.
- **Layout**: 3-row grid. Top row: Key Partners | Key Activities + Key Resources | Value Proposition | Customer Relationships + Channels | Customer Segments. Bottom row: Cost Structure (left half) | Revenue Streams (right half)
- **Box sizes**: All blocks same width within their column
- **Colors**: Each block gets a distinct pastel fill from the palette
- **Camera**: Start L (800x600), zoom to XL (1200x900) for full view

#### `competitive-landscape`
2x2 matrix with competitor positioning.
- **Layout**: Large square divided into 4 quadrants with axis labels. Competitors as circles positioned within quadrants
- **Axes**: User provides X and Y axis labels (e.g., "Price" vs "Quality")
- **Colors**: Each quadrant a different pastel zone. Competitor circles use accent colors
- **Camera**: M (600x450) — compact, single view

#### `growth-flywheel`
Circular cause-and-effect loop.
- **Layout**: 4-6 nodes arranged in a circle, connected by curved arrows flowing clockwise
- **Center**: Title of the flywheel in the center
- **Colors**: Gradient of fills around the circle (blue → green → amber → purple)
- **Camera**: M (600x450) — compact circular layout

#### `okr-tree`
Hierarchical Objective → Key Results → Initiatives.
- **Layout**: Top-down tree. Objective at top (large), Key Results below (medium), Initiatives at bottom (smaller)
- **Colors**: Objective = purple, KRs = blue, Initiatives = green
- **Camera**: Start on Objective (S 400x300), zoom out to full tree (L 800x600)

#### `value-chain`
Linear flow from inputs to customer value.
- **Layout**: Horizontal chain of 4-7 boxes with arrows between them
- **Colors**: Gradient from light blue (input) to light green (output)
- **Camera**: L (800x600) — horizontal layout needs width

### Process & Journey

#### `user-journey`
Horizontal timeline with stages and touchpoints.
- **Layout**: Horizontal timeline with stage headers, touchpoint cards below, emotion indicators (happy/neutral/frustrated) per stage
- **Colors**: Stages alternate between two pastel fills. Pain points highlighted in light red
- **Camera**: Progressive pan left-to-right through stages, final XL zoom-out

#### `swimlane`
Multi-actor process flow with horizontal lanes.
- **Layout**: Horizontal lanes (one per actor), process boxes flow left-to-right within lanes, arrows cross lanes for handoffs
- **Colors**: Each lane has a distinct background zone color (opacity 30). Process boxes use the lane's accent color
- **Camera**: Progressive pan following the flow, final zoom-out

#### `decision-tree`
Binary/multi-branch decision flow.
- **Layout**: Top-down tree. Diamond shapes for decisions, rectangles for outcomes
- **Colors**: Decisions = light yellow, positive outcomes = light green, negative outcomes = light red
- **Camera**: Start at root decision (S), progressive zoom-out as branches expand

#### `funnel`
Tapering pipeline visualization.
- **Layout**: Vertical stack of progressively narrower rectangles (or trapezoids simulated with rectangles). Labels centered in each stage. Conversion rates on the right
- **Colors**: Gradient from wide (light blue) to narrow (light green for success) or (light red for drop-off)
- **Camera**: M (600x450) — vertical, compact

#### `timeline`
Horizontal milestone/roadmap view.
- **Layout**: Horizontal arrow line with milestone markers above/below (alternating). Date labels on the line, descriptions in cards
- **Colors**: Past milestones = light green (completed), current = light yellow (active), future = light blue (planned)
- **Camera**: Progressive pan left-to-right, final zoom-out

### Technical-Executive

#### `architecture`
High-level system architecture with grouped layers.
- **Layout**: 3-4 horizontal layer zones (e.g., Frontend, API, Services, Data). Key components as boxes within each zone. Arrows show data flow between layers
- **Colors**: Each layer zone uses a distinct background color (opacity 30). Components within use the zone's pastel fill
- **Camera**: Start at top layer (M), pan down through layers, final XL zoom-out

#### `data-flow`
Source → Transform → Destination flow.
- **Layout**: Left-to-right flow. Source boxes on left, transformation/processing in middle, destination on right
- **Colors**: Sources = light blue, transforms = light purple, destinations = light green
- **Camera**: L (800x600) — horizontal flow

#### `org-chart`
Hierarchical team/department structure.
- **Layout**: Top-down tree. CEO/leader at top, departments below, teams below that
- **Colors**: Each department gets a distinct pastel fill. Leader nodes slightly larger
- **Camera**: Start at top (S), zoom out to full org (L or XL depending on size)

---

## Example: Generating a Funnel

User says: `/excalidraw funnel`

**Step 1**: Ask clarifying questions:
- "What are the funnel stages? (e.g., Awareness → Interest → Consideration → Purchase)"
- "How many elements max? (I recommend 4-6 for a clean funnel)"
- "Do you want conversion rates between stages?"

**Step 2**: Generate elements (example for 4-stage marketing funnel):

```json
[
  {"type":"cameraUpdate","width":600,"height":450,"x":50,"y":20},
  {"type":"text","id":"title","x":180,"y":40,"text":"Marketing Funnel","fontSize":24,"strokeColor":"#1e1e1e"},
  {"type":"rectangle","id":"s1","x":100,"y":100,"width":340,"height":60,"backgroundColor":"#a5d8ff","fillStyle":"solid","roundness":{"type":3},"strokeColor":"#4a9eed","strokeWidth":2,"roughness":0},
  {"type":"text","id":"s1-t","x":155,"y":120,"text":"Awareness — 10,000","fontSize":18,"strokeColor":"#1e1e1e"},
  {"type":"rectangle","id":"s2","x":140,"y":180,"width":260,"height":60,"backgroundColor":"#d0bfff","fillStyle":"solid","roundness":{"type":3},"strokeColor":"#8b5cf6","strokeWidth":2,"roughness":0},
  {"type":"text","id":"s2-t","x":175,"y":200,"text":"Interest — 3,200","fontSize":18,"strokeColor":"#1e1e1e"},
  {"type":"text","id":"c1","x":420,"y":155,"text":"32%","fontSize":16,"strokeColor":"#757575"},
  {"type":"rectangle","id":"s3","x":170,"y":260,"width":200,"height":60,"backgroundColor":"#ffd8a8","fillStyle":"solid","roundness":{"type":3},"strokeColor":"#f59e0b","strokeWidth":2,"roughness":0},
  {"type":"text","id":"s3-t","x":185,"y":278,"text":"Consideration — 800","fontSize":16,"strokeColor":"#1e1e1e"},
  {"type":"text","id":"c2","x":420,"y":235,"text":"25%","fontSize":16,"strokeColor":"#757575"},
  {"type":"rectangle","id":"s4","x":200,"y":340,"width":140,"height":60,"backgroundColor":"#b2f2bb","fillStyle":"solid","roundness":{"type":3},"strokeColor":"#22c55e","strokeWidth":2,"roughness":0},
  {"type":"text","id":"s4-t","x":215,"y":360,"text":"Purchase — 200","fontSize":18,"strokeColor":"#1e1e1e"},
  {"type":"text","id":"c3","x":420,"y":315,"text":"25%","fontSize":16,"strokeColor":"#757575"}
]
```

**Step 3**: Call `create_view`, then `export_to_excalidraw`, then `save_checkpoint`.

**Step 4**: Present link: "Here's your funnel diagram: [excalidraw.com link]"

---

## Iteration Example

User says: "Add a 'Retention' stage after Purchase"

**Step 1**: Read checkpoint
**Step 2**: Generate:
```json
[
  {"type":"restoreCheckpoint","id":"<previous-checkpoint-id>"},
  {"type":"rectangle","id":"s5","x":220,"y":420,"width":100,"height":60,"backgroundColor":"#c3fae8","fillStyle":"solid","roundness":{"type":3},"strokeColor":"#06b6d4","strokeWidth":2,"roughness":0},
  {"type":"text","id":"s5-t","x":228,"y":440,"text":"Retention — 150","fontSize":16,"strokeColor":"#1e1e1e"},
  {"type":"text","id":"c4","x":420,"y":395,"text":"75%","fontSize":16,"strokeColor":"#757575"},
  {"type":"cameraUpdate","width":600,"height":450,"x":50,"y":20}
]
```

**Step 3**: Re-export, save new checkpoint.

---

## Dark Mode

If the user requests dark mode, add a massive dark background as the VERY FIRST element (before cameraUpdate):

```json
{"type":"rectangle","id":"darkbg","x":-4000,"y":-3000,"width":10000,"height":7500,"backgroundColor":"#1e1e2e","fillStyle":"solid","strokeColor":"transparent","strokeWidth":0,"roughness":0}
```

Then adjust all colors:
- Text: `#e5e5e5` (primary), `#a0a0a0` (secondary). NEVER darker than `#a0a0a0`
- Fills: Use dark variants — `#1e3a5f` (blue), `#1a4d2e` (green), `#2d1b69` (purple), `#5c3d1a` (orange), `#5c1a1a` (red), `#1a4d4d` (teal)
- Strokes: Use the bright accent colors (they're visible on dark backgrounds)

---

## Common Mistakes to AVOID

1. **Using `label` property on shapes** — Labels frequently don't render. ALWAYS use standalone text elements positioned inside boxes instead
2. **Inconsistent box sizes** — Same-level elements must be identical dimensions
3. **Text overflow** — Shorten text before resizing boxes
4. **Overlapping text** — Always verify text doesn't overlap adjacent elements or other text
5. **Too many colors** — Max 3-4 fill colors per diagram
6. **Forgetting roughness: 0** — Every element must have sharp edges
7. **Skipping auto-export** — ALWAYS export and present the shareable link
8. **Tiny text** — Never below fontSize 16 for body, 14 absolute minimum for annotations
9. **Missing cameraUpdate** — Always start with a camera element
10. **Non-4:3 camera** — Always use exact 4:3 sizes (400x300, 600x450, 800x600, 1200x900, 1600x1200)
11. **Reusing deleted IDs** — Always generate fresh IDs for replacement elements
12. **Text not centered in box** — Use the centering formula: `text_x = box_x + (box_width/2) - (text_length * fontSize * 0.3)`
