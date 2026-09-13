Yes. **This is very feasible, and it matches Cubacadabra Studio surprisingly well.** The important terminology is: I would **not** build a “ChatGPT plugin.” I would make **Cubacadabra Studio a custom Codex client**, using OpenAI’s **Codex App Server**.

OpenAI explicitly describes App Server as the interface for embedding Codex into your own product, including **authentication, conversation history, approvals, and streamed agent events**. ([OpenAI Developers][1])

And crucially for your goal, Codex supports **“Sign in with ChatGPT for subscription access”** rather than requiring an API key. The App Server login protocol can open the browser for ChatGPT authentication and even reports the authenticated plan type, such as `plus`. ([developers.openai.com][1])

So the experience could literally be:

```text
Cubacadabra Studio
┌─────────────────────────────────────────────────────────┐
│ World   Assets   Materials   Morphs   Test              │
│                                                         │
│                 GAME / EDITOR                           │
│                                             ┌─────────┐ │
│                                             │ Codex   │ │
│                                             │         │ │
│                                             │ Make my │ │
│                                             │ player  │ │
│                                             │ jump 2x │ │
│                                             │ higher  │ │
│                                             │         │ │
│                                             │ [Send]  │ │
│                                             └─────────┘ │
└─────────────────────────────────────────────────────────┘
                  │
                  ▼
       bundled `codex app-server`
                  │
          ChatGPT login
                  │
         user's Plus account
                  │
                  ▼
       project/src/*.luau
       project/manifest.json
```

I would build it roughly like this:

1. **Add a Codex side panel to Studio**, rather than making it another full workspace. Your current `Workspace` enum already has World, Assets, Materials, Morphs, and Test, so structurally either approach is easy.  I prefer a persistent right panel because someone could say “move that platform over there” while still looking at the World view.

2. **Bundle a known version of the Codex executable with Studio** and launch:

   ```text
   codex app-server
   ```

   Studio talks to it over stdin/stdout using JSONL. That's the documented default transport, and it's particularly convenient for your Rust app. ([OpenAI Developers][1])

   You do **not** need Node, Electron, JavaScript, or the TypeScript SDK. Your Studio is already native Rust/egui/wgpu, with `serde_json` available, so implementing the JSON-RPC-ish App Server protocol directly is a natural fit.

3. On first use, show something like **“Connect ChatGPT”**. Studio asks App Server for account status. If not authenticated, call its ChatGPT login flow. Browser opens, user logs into ChatGPT, browser returns, and Studio now has Codex connected.

   This is the part that makes your idea especially compelling: **their ChatGPT subscription powers the Codex usage** rather than you providing an OpenAI API key and eating the bill. OpenAI distinguishes ChatGPT subscription authentication from API-key, usage-based API billing. ([OpenAI Developers][2])

4. Give each Codex thread the game's **raw `project_root` as its working directory**. Your latest Studio code already keeps `project_root: PathBuf` separately from `game_root`, which is exactly what you want.

   That distinction matters because Studio already takes:

   ```text
   src/main.luau
   manifest.json
   assets/
   ```

   builds the game, and runs the resulting package from a Studio-owned temporary directory.

   So Codex changes:

   ```text
   my-game/src/main.luau
   ```

   **not** the temporary generated `game.luau`.

5. Give Codex `workspaceWrite` access to **only that project directory**, keep network access off by default, and surface its approval requests in the Studio UI. App Server explicitly supports setting the working directory, sandbox policy, writable roots, and approval policy per turn. ([OpenAI Developers][1])

Then the really nice Cubacadabra-specific workflow becomes:

```text
User:
"Make the cactus hurt the player when they touch it."

                ↓

Codex reads:
manifest.json
src/main.luau
other Luau modules
AGENTS.md

                ↓

Codex edits the Luau

                ↓

Studio notices files changed

                ↓

cubacadabra build-game

                ↓

Studio reloads the game

                ↓

User immediately tests it
```

That would be **way better** for a beginner than “install Codex, open Terminal, cd into the game directory, run codex, explain what Cubacadabra is...”

### Your `AGENTS.md` becomes especially valuable

I'd make every Cubacadabra project contain a good `AGENTS.md` explaining the Cubacadabra SDK, project structure, build commands, Luau conventions, available APIs, and things Codex should/shouldn't modify.

Then the user doesn't have to write:

> Using Cubacadabra's Luau API and our specific manifest schema...

They just say:

> Add a day/night cycle.

Codex starts inside the game directory and already understands what it's working on.

### I would bundle Codex, not make users install it separately

The clean UX should be:

```text
Download Cubacadabra Studio
        ↓
Open game
        ↓
Click AI
        ↓
Connect ChatGPT
        ↓
Browser login
        ↓
Start asking Codex to change the game
```

No Terminal. No Homebrew. No `npm install`. No “first install the Codex CLI.”

The Codex repository is Apache 2.0 licensed, which permits redistribution subject to its license/notice requirements.  I would keep the Codex executable as a **separate helper process** bundled inside Studio rather than linking its internals into Studio. That also gives you a very clean architecture:

```text
Cubacadabra Studio GPL
        │
        │ stdio
        ▼
OpenAI Codex binary
Apache 2.0
```

And I would pin a specific Codex build inside each Studio release. You don't want a random separately-installed Codex update changing the App Server protocol and suddenly breaking Studio.

### One significant caveat

There is one thing I would put a yellow flag around today. OpenAI clearly documents App Server as the mechanism for custom clients, **but the current docs also characterize App Server / some of its transport surface as experimental and not yet something to treat as a permanently stable production API.** ([OpenAI Developers][1])

That wouldn't stop me from doing this. It would make me:

**Cubacadabra AI — Beta**

and then pin the Codex version you bundle. Use only the documented stdio transport, not the experimental WebSocket transport. When you update Studio, update Codex deliberately and test against that version.

That isolates you from almost all of the instability.

### The alternative is worse for what you want

You could call the OpenAI Responses/API directly from Studio and build your own coding agent. But then:

```text
ChatGPT Plus subscription
           ≠
OpenAI API credits
```

The developer would need API billing, and you'd be rebuilding filesystem tools, diffs, approvals, shell execution, context management, conversation history, sandboxing, etc.

**Codex App Server already gives you all of that.**

So my recommendation is quite strong:

> **Cubacadabra Studio should have a native “Codex” panel backed by a bundled, pinned `codex app-server` helper. Users click “Connect ChatGPT,” authenticate with their own ChatGPT account, and Codex gets workspace-write access only to the currently open Cubacadabra game's source directory.**

This isn't a hack around ChatGPT. **It's almost exactly the use case OpenAI created App Server for.**

And looking at your actual Studio code, you're already unusually well positioned for it: native Rust, explicit `project_root`, raw source vs generated package separation, an existing workspace shell, and the rebuild path are all there.

If I were choosing the next substantive Studio feature, **I would seriously consider this one.** It could turn Cubacadabra from “a game engine that happens to use Luau” into something where a 12-year-old can type *“make the floor disappear five seconds after I step on it”* and immediately see the result.

[1]: https://developers.openai.com/codex/app-server/ "Codex App Server | ChatGPT Learn"
[2]: https://developers.openai.com/codex/auth/ "Authentication | ChatGPT Learn"

