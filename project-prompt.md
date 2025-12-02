Goal: Design a clean, modern, friendly yet productivity-focused Event Planning Dashboard screen for the Momento app. This screen allows users to coordinate event planning with collaborators, assign tasks, share notes, and receive smart gift suggestions.

Overall Visual Style

Minimal and elegant layout with plenty of white space

Sophisticated extended rounded rectangles for cards and buttons

Soft, warm accent colors (brand: deep purple + coral + cool teal)

Typography hierarchy:

Headings: bold, humanist sans-serif (e.g., Inter, SF Pro, Poppins)

Body text: lightweight and legible

Subtle drop shadows for elevation

Page Structure

Top Navigation Section

Left-aligned:

“< Back” link in subtle neutral text, hover underline

Event Name: Large, bold title (editable)

Remaining days: friendly secondary text (e.g., “6 days left”) with small calendar icon

Right-aligned:

Greeting with user avatar: “Hi Ahmad!”

Pencil icon “Edit Event Details” — outlined rounded button, light hover glow

Collaborators Section

Subtitle: “Collaborators”

Pill-style collaborator tags with name + subtle avatar initial

Teal tone for pills, hover: glowing border

“Invite +” pill styled as a ghost button with teal border → triggers modal for inviting collaborators

Planning Checklist

Section title: “Planning Checklist”

Each task row styled as a horizontal task card:

Left: square checkbox with animated check state and priority color highlight

Task name: clear editable text

Right: "Assignees" area — same pill-style user tags (compact)

On hover: card border accent + slight elevation

Add new task CTA at bottom (icon + label)

Shared Notes

Subtitle with small helper text:
"Each user can selectively choose to share notes they gathered on person."

Note items appear as soft bordered cards with inline editing

Each note aligned with an assignees pill group to the right

Icons for edit/delete appear only on hover to reduce clutter

Primary Bottom CTA

Full-width primary action bar fixed at bottom of viewport

Purple gradient button with a lightbulb icon:
“Get Suggestions”

Purpose: triggers LLM call to get gift/idea suggestions

Hover: subtle pulse animation indicating intelligence/AI

Micro-Interactions & Feedback

Smooth transitions for task/note editing

Drag-drop reordering of tasks

Toast confirmations when collaborator added, task updated, etc.

Soft confetti animation after suggestion results come in

Icons & Visual Identity

Use outlined icon style

Light playful touches (e.g., rounded corners, mild gradients) while retaining professional event-planning reliability

Final Output Expectations

Produce:

A visually polished, production-ready layout

Clear UI states (empty tasks, hover, editing)

Desktop-first design with consideration for tablet & mobile responsiveness

Exportable component styles for engineers