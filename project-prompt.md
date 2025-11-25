1️⃣ Purpose of the Screen

This view helps users introduce a new person into their care network. The experience should feel friendly and celebratory, reinforcing the emotional value of adding someone special.

2️⃣ Page Layout & Structure

Overall visual

Centered form layout with generous whitespace

Soft neutral background (light grey or off-white)

Card-style form container with subtle depth (shadow or thin border)

Top Bar

Persistent mini-header similar to Home Dashboard:

Left: Brand mark (“Momento”)

Right: User mini-profile + greeting (clickable → account menu)

3️⃣ Page Title + Warm Personalized Tagline

Centered near top of form:

Primary Title

Add New Profile

Large, bold font to establish importance

Center-aligned

Subtitle

Let’s get to know someone special ❤

Smaller and friendly

Soft grey tone to feel warm and supportive

4️⃣ Form Structure
A. Name Input Field

Label: Name

Input:

Placeholder: “Enter their name”

Rounded corners with subtle border or underscored line style

Clear focus state: highlighted bottom border or soft glow

B. Relationship Dropdown Selector

Label: Relationship

Dropdown appearance:

Same style as text input for consistency

Chevron icon aligned to right

Placeholder: “Select a relationship”

Options (suggested default list):

Family

Friend

Partner

Colleague

Other (opens subtle text input if selected)

Dropdown panel:

Slight overlay shadow

Rounded corners

Smooth open animation

5️⃣ Create Profile Button (Primary Action)

Full-width button inside form column

Pill-shaped with high contrast background (brand accent color)

Text: Create Profile

Large, semi-bold typography

White or dark text depending on button color

Hover & pressed states:

Slight elevation

Color shift or gentle animation for responsiveness

Disabled state (until form valid):

Lighter tone + no hover elevation

Submitting state:

Button shows spinner with text like "Creating..."

6️⃣ Micro-copy & Validation Rules
Field Validation

Name: required, at least 1 character

Relationship: required selection

Error messaging

Inline text appears below field (small red accent)

e.g., “Please enter a name”

e.g., “Please select a relationship”

UI should not allow submission until all required fields are valid.

7️⃣ Navigation & Behavior
Action	Result
Successful save	Calls Profile.createProfile → navigate to that profile’s detail page with toast success message
Cancel/back (implicit)	Standard browser back or UI icon if included
Dropdown “Other” selection	Opens mini supplementary input for relationship label

All data sent is mapped to backend concepts:

Link newly created profile to current logged-in user via session data

8️⃣ Emotional Touches

Success feedback should feel positive:

Confetti micro-animation OR

Small friendly toast like:

🎉 Profile created! Let’s make great memories.

An optional cute illustrated placeholder silhouette can appear above the name field to hint profile personalization coming later

Final Vision Summary

This screen turns a simple form into a meaningful act, focusing on care and connection. Clean typography, thoughtful spacing, and intuitive controls ensure adding a relationship is frictionless and warm. It's efficient while still feeling personal — true to the core of Momento.