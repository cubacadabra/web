Yes. Looking back at the pricing direction we had already developed for Cubacadabra, I think **$20/month can work very well — but not as "hosting costs $20."** That framing loses immediately to Roblox.

Roblox explicitly markets its creator proposition as **“Robust tools with no upfront costs”** and says it covers hosting, storage, customer support, localization, payment processing, and platform fees. Normal multiplayer servers don't require creators to pay for servers. ([Creator Hub][1]) Even its newer paid Extended Services sit *above* generous default limits; for example, standard compute can continue with unlimited player-hours under normal limits without paying for Extended Compute. ([Creator Hub][2])

So I would make one major adjustment to the pricing model we discussed before:

## Cubacadabra should be free to create **and publish**

That's strategically important.

A kid, student, hobbyist, open-source developer, or curious Roblox developer should be able to:

**download Studio → build a Cube → publish it → have people play it**

without entering a credit card.

If Cubacadabra says:

> Roblox: $0
> Cubacadabra: $20/month

you're fighting uphill.

Instead:

> Roblox: free closed ecosystem
> Cubacadabra: free open ecosystem
> **Cubacadabra Pro: $20/month if you want to help build the alternative and get serious creator tooling**

That is a completely different sale.

And it fits the philosophy you've been developing for Cubacadabra: **kids play; adults, professional creators, studios and organizations pay for services around the experience.**

---

# The pricing model I'd use

|                            |   Free Creator |    **Creator Pro** |           Studio | Organization |
| -------------------------- | -------------: | -----------------: | ---------------: | -----------: |
| Price                      | **$0 forever** |         **$20/mo** |       **$99/mo** | **$299+/mo** |
| Public Cubes               |              ✓ |                  ✓ |                ✓ |            ✓ |
| Multiplayer hosting        |              ✓ |                  ✓ |                ✓ |            ✓ |
| Normal asset hosting       |              ✓ |                  ✓ |                ✓ |            ✓ |
| Player data                |              ✓ |                  ✓ |                ✓ |            ✓ |
| Cubacadabra Studio         |              ✓ |                  ✓ |                ✓ |            ✓ |
| Publish everywhere         |              ✓ |                  ✓ |                ✓ |            ✓ |
| Source/Git integration     |          Basic |           Enhanced |         Enhanced |     Enhanced |
| Private Cubes              |              — |                  ✓ |                ✓ |            ✓ |
| Version history            |          Basic |               Full |             Full |         Full |
| Analytics                  |          Basic |           Advanced |         Advanced |     Advanced |
| Crash reports              |          Basic |               Full |             Full |         Full |
| Cloud builds               |              — |                  ✓ |                ✓ |            ✓ |
| Preview/staging worlds     |              — |                  ✓ |                ✓ |            ✓ |
| Custom domain              |              — |                  ✓ |                ✓ |            ✓ |
| Collaborators              |              — |                2–3 |               ~5 |       Custom |
| Team permissions           |              — |                  — |                ✓ |            ✓ |
| Additional storage/compute |        Metered | Included allowance | Larger allowance |     Contract |
| Support                    |      Community |           Priority |         Priority |       Direct |
| **Support Cubacadabra**    |              ♡ |              **✓** |            **✓** |        **✓** |

That's pretty close to the **Free / Pro $20 / Team $99 for five seats / Business $299+** model we'd previously kicked around.

But I'd now be much more deliberate about *why* someone buys Pro.

---

# Don't sell $20 worth of CPU

This is the big conceptual distinction.

Suppose somebody's Cube costs Cubacadabra $1.73 that month.

Don't make yourself invent $18.27 worth of fake infrastructure justification.

Instead, you're selling **three things together**:

### 1. Professional tools

These are genuine SaaS features.

Think GitHub Pro + Vercel + Sentry + TestFlight + game backend tooling bundled together:

**private projects
long-term version history
cloud builds
staging environments
analytics
crash diagnostics
collaboration
custom domains
asset management
automated testing
larger quotas**

A serious developer can easily understand $20 for that.

### 2. Higher resource allowances

Don't meter every byte like AWS.

Give Pro something like:

> **Generous hosting included. No surprise bills.**

For example, eventually:

**Free**

* 5 GB creator assets
* reasonable DB storage
* normal compute
* normal bandwidth
* public Cubes

**Pro**

* 100 GB creator assets
* much larger persistent storage
* increased compute limits
* higher API limits
* private Cubes

And only truly huge applications encounter metered overages.

That's psychologically much nicer than:

> $0.000017 per compute-widget-second.

Roblox itself has gone in this direction with Extended Services: developers set monthly budgets and Roblox throttles paid services at the budget rather than producing an unlimited surprise bill. ([Creator Hub][2])

I'd copy that safety property.

---

# 3. And yes: **support the movement**

I think this part is unusually credible for Cubacadabra.

Don't hide it.

I'd actually put it right on the pricing page.

Something like:

> **Creator Pro — $20/month**
>
> Everything you need to take your Cubes further — plus your membership helps fund an independent, open-source alternative to closed game platforms.

Now the purchase has two layers.

**Transactional value:**
"I get these useful tools."

**Mission value:**
"I want this thing to exist."

That's exactly how people willingly pay money for software for which free alternatives exist.

You don't need every subscriber to consume $20 worth of infrastructure.

---

# You can lean into "supporter" much harder

There's an interesting demographic distinction from Roblox.

A substantial number of your first Cubacadabra developers probably aren't going to be 11-year-olds.

They're going to be people like:

* Rust developers
* open-source developers
* indie game developers
* parents
* ex-Roblox developers
* developers uncomfortable with Roblox's direction
* educators
* people fascinated by what you're building

Some of them will think:

> "$20? Sure. I want these guys to succeed."

That is **valuable willingness-to-pay Roblox doesn't really capture** because Roblox doesn't need it.

And $20 isn't crazy for developers. It's approximately one lunch in LA, while developers routinely pay $10–$30/month for individual developer services.

So I'd actually consider naming the initial tier:

### **Founding Creator — $20/month**

During the early period.

They could receive:

**Creator Pro forever while subscribed
Founding Creator profile mark
name in the project supporters page, optionally
early builds
beta features
private Cubes
larger limits
direct feedback channel**

Crucially: **no ranking advantage.**

Given your existing no-ads / no-pay-for-placement philosophy, don't ever make it:

> Pay $20 and your Cube gets promoted.

Keep discovery authentic. That's part of the brand.

---

# There's another way you can beat Roblox

Roblox's "$0" isn't actually the entire economic story.

Roblox captures value primarily when money flows through its ecosystem. Its creator economy uses Robux, DevEx conversion rates, marketplace commissions, and platform-controlled monetization. For example, Roblox currently lists the standard DevEx cash-out rate as **$0.0038 per Earned Robux**, with a higher rate for certain eligible purchases from age-verified U.S. adults. ([Creator Hub][3]) Marketplace economics can also involve substantial platform/creator splits depending on where and what is sold. ([Creator Hub][4])

Cubacadabra can make a much more developer-friendly philosophical offer:

> **Pay us for services. We don't need to own your economy.**

That's powerful.

Imagine eventually saying:

### Roblox

**$0/month**
Free hosting
Closed runtime
Closed ecosystem
Robux economy
Roblox controls distribution and monetization
Roblox determines the rules

versus:

### Cubacadabra

**$0/month Free**
Create and publish
Free normal hosting
Open-source engine/runtime
Open formats
Your source code is yours
No ads
No paid placement

### Cubacadabra Pro — $20/month

Everything above, plus serious professional tooling, higher limits, private development, and **funding the independent platform itself**.

Now $20 doesn't look expensive.

It looks like the premium version of something philosophically different.

---

# I'd actually make $20 the *middle*, not the entrance

This is important for network effects.

Cubacadabra desperately needs **Cubes and creators** more than it needs $20 from every developer during its early life.

Charging admission attacks the thing you need most.

I'd therefore be generous:

> **CREATE — FREE**
>
> Build. Publish. Host. Multiplayer. Forever.

Then directly underneath:

> **CREATOR PRO — $20/month**
>
> Go further — and help keep Cubacadabra independent.

That's a strong pricing page.

---

## What should actually be behind Pro?

I'd be fairly restrained. **Don't cripple Free.**

Free should make a complete real game.

Pro should make running a serious project substantially nicer:

* Unlimited/private Cubes
* Full version history and rollbacks
* Development/staging/production environments
* Advanced analytics
* Logs and crash reports
* Cloud builds
* Scheduled builds/deployments
* Team collaboration
* GitHub integration
* Custom domains
* Larger asset/storage limits
* Higher backend/API quotas
* More concurrent test servers
* Automated device/platform testing
* Priority support
* Experimental/preview tooling
* Perhaps some AI/compute credits later

Those are exactly the sorts of capabilities we'd previously identified for the $20 tier.

But **never put basic multiplayer, publishing, or basic hosting behind it.**

Those need to be your Roblox parity layer.

---

# One thing I'd change from our old tiers

Previously we had approximately:

**Free → $20 Pro → $99 Team/5 seats → $299+ Business.**

I still like it, but I'd simplify the names:

| Plan             |        Price | Who it's really for                      |
| ---------------- | -----------: | ---------------------------------------- |
| **Creator**      |         Free | Everyone                                 |
| **Creator Pro**  |   **$20/mo** | Serious individual creators + supporters |
| **Studio**       |   **$99/mo** | Small professional teams                 |
| **Organization** | **$299+/mo** | Schools, companies, larger studios       |

That lets you have another clever policy:

### Open-source Cubes get Pro-ish infrastructure free.

You're building an open-source platform. Rewarding open development would be extremely on-brand.

Something like:

> Public open-source Cubes receive generous hosting and collaboration features at no charge.

Then $20 becomes even less objectionable because you're clearly not toll-gating creation. You're asking people who want private/professional conveniences to subsidize the commons.

---

# And your $9.99 parent subscription still fits

This preserves the business model you've been gravitating toward:

**Children:** free.

**Ordinary creators:** free.

**Parents who want ongoing parental tools:** ~$9.99/month.

**Serious developers/supporters:** $20/month.

**Studios:** $99+.

**Organizations:** $299+.

No ads.

No pay-for-placement.

No artificial in-game currency whose economics you depend upon.

That gives Cubacadabra several independent revenue streams without making **children themselves the monetized object**.

And that's much more interesting to me than trying to duplicate Roblox's business model.

---

## The sentence that sells the $20

I wouldn't say:

> **Creator Pro — More storage and compute. $20/month.**

That's weak against free Roblox.

I'd say:

> **Creator Pro — $20/month**
> Professional tools, higher limits, private development, and a direct way to support an independent, open-source game platform.

And immediately beside it:

> **Creator — Free forever**
> Build, publish, host and share real multiplayer games. No credit card required.

**That makes the $20 price a choice rather than a toll.**

And I think that's the answer to the concern you're identifying: **you shouldn't try to justify why Cubacadabra costs $20 while Roblox costs $0. Make Cubacadabra also cost $0. Then give people enough reasons to *want* to give you $20.**

[1]: https://create.roblox.com/docs/get-started/why-build-on-roblox?utm_source=chatgpt.com "Why should I develop on Roblox? | Documentation - Roblox Creator Hub"
[2]: https://create.roblox.com/docs/cloud-services/extended-services?utm_source=chatgpt.com "Extended Services | Documentation - Roblox Creator Hub"
[3]: https://create.roblox.com/docs/production/monetization/developer-exchange?utm_source=chatgpt.com "Roblox Developer Exchange Program | Documentation - Roblox Creator Hub"
[4]: https://create.roblox.com/docs/marketplace/marketplace-fees-and-commissions?utm_source=chatgpt.com "Marketplace fees and commissions | Documentation - Roblox Creator Hub"

