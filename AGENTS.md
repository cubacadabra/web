do not run playwright

never write typescript keep this project javascript only

do not launch your own npx vite --host 127.0.0.1 i already have it running on http://localhost:5173/

the brand name is "cubacadabra" lowercase never write it "Cubacadabra"

## UI Design Principle: Prefer Utilitarian Density

When making UI changes, default to the simplest presentation that clearly exposes the actual information and controls.

Prefer:
- compact lists, rows, tables, and straightforward forms
- normal-sized headings
- information visible immediately without scrolling through decorative content
- existing application chrome and navigation
- restrained spacing and typography
- direct labels such as "Blocked Users", followed by the actual blocked users
- empty states that are one short sentence

Avoid unless explicitly requested:
- oversized H1/hero typography
- marketing-style section introductions
- eyebrow text such as "YOUR SAFETY SETTINGS" or "YOUR BLOCK LIST"
- large explanatory tiles
- decorative horizontal rules
- repeated headings that say essentially the same thing
- large amounts of whitespace
- inspirational/product-copy phrases such as "A quieter world, on your terms."
- splitting a small amount of information across multiple visual sections
- burying the useful data below descriptive copy

For authenticated settings/admin/product UI, think "utility application", not "landing page".

If the page's purpose is to show a list, show the list.

For example, a Blocked Users page should generally look like:

    Blocked Users

    user-one        Unblock
    user-two        Unblock

or, when empty:

    Blocked Users

    You haven't blocked anyone.

Do not turn this into a hero page with multiple headings, explanatory panels, slogans, and section dividers unless the request specifically calls for that treatment.

### Less Is More

Before adding a UI element, ask:

1. Does this help the user perform the task?
2. Does this communicate information the user does not already know?
3. Would removing it make the page less understandable?

If the answer to all three is no, leave it out.

When modifying an existing simple UI, preserve its level of visual complexity unless the user explicitly asks for a redesign.
