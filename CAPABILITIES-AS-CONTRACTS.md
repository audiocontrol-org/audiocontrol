# Capabilities as Contracts

## A Methodology for Refactoring Evolving GUIs Without Regression

> **Thesis:** GUIs evolve safely when their capabilities are documented as stable contracts independent of implementation. Three artifacts make that separation operational: a capability inventory, a test-name protocol that binds tests to capabilities, and an atomic-primitive design system. The inventory makes capabilities enumerable; the test-name protocol makes coverage auditable; the design system makes implementation swappable.

---

## 1. The Problem — Why GUIs Decay

Every long-lived GUI accumulates the same pathology. The first version ships clean: there is a design system, a small set of components, a test suite, a clear convention. Then features land. Each feature introduces an exception ("this one screen needs a different button style"). Each release polishes one corner of the product. Each refactor leaves one stratum cleaner than the rest. After three years the codebase has six button styles, four ways to render a form field, two competing date pickers, and a test suite that breaks every time someone touches the CSS.

The team's response is usually a redesign. A new senior engineer or a new design lead proposes a clean-up: unify the buttons, retire the second date picker, refresh the visual identity. The work is real, the intent is good, and the risk is enormous. Redesigning a live product is not a fresh-paint problem; it is a sequence of subtle behavioral changes, each of which could break something a customer depends on, each of which slips past the team because the test suite tests the *old* implementation, not the *desired behavior*.

The deeper failure mode is what we will call the **shell-partial trap**. A team announces a redesign. The first pass polishes the page chrome: a new header rhythm, a new typography scale, a new layout grid. The interior controls — sliders, dropdowns, checkboxes, parameter editors — keep their original implementations because the team is moving fast and the shell-level changes are visually loudest. A pull request lands titled *"PatchesPage redesign — polish complete"*. Behind the polished outer chrome, the page still renders `<input type="range">` with hand-rolled webkit styling and the old per-page checkbox class. No one is lying; the commit really does deliver visible polish. But the page is not "done" in any sense that matters for the redesign's goals: a user comparing the old and new versions side-by-side will see a polished header above a 1990s slider, and a designer auditing the page will find that the canonical atomic controls — the components that were supposed to standardize the visual language — never landed.

The shell-partial trap is structural, not a matter of effort. It happens because the unit of work the team can plan, ship, and review is "a page" or "a feature," but the unit of design coherence is "every atomic control across every page." The team has incentives that pull toward shipping visible progress on page boundaries; the incentives that pull toward fixing every slider, every dropdown, every checkbox to use the canonical primitives are diffuse, invisible, and easy to defer. Once a page ships with the shell-partial pattern, the next page tends to copy it: the convention drifts, the original intent erodes, and six months later the redesign has produced a thin layer of polished chrome over the same legacy interior.

A second failure mode compounds the first: **test suites tend to bind to implementation, not behavior**. A test that says *"clicking the slider at x-position 300 produces value 80"* is testing a Radix-based slider's geometry, not the capability *"the user can set a parameter's value to 80"*. The first definition breaks when the slider is replaced with a different primitive; the second definition is durable. Most teams write the first kind of test by default — it is faster to write, it produces concrete failures, it feels rigorous. The cost is that every implementation refactor breaks tests it should not break, and the team responds by either skipping tests during refactors (which loses the safety net) or by writing fewer tests of UI behavior (which loses the coverage). After several rounds of this, the project's UI test suite tests almost nothing useful about the GUI's behavior; it tests the shape of the DOM at a moment in time.

The thesis of this essay is that these failure modes are avoidable, and the avoidance is methodological rather than technical. A team can preserve design coherence across a refactor *and* keep their test suite useful across implementation changes if they invest in three artifacts that separate the *what* from the *how* of the GUI. The investment is modest, the techniques generalize, and the safety the methodology provides scales with the size and longevity of the product.

---

## 2. The Insight — Separate What from How

The methodology rests on a simple distinction. A GUI has two kinds of properties: the **capabilities** it offers to users, and the **implementations** that realize those capabilities. Capabilities are durable: the user can change the volume, save a document, navigate to a sub-page, see an error when a field is invalid. Implementations are transient: today the volume control is a Radix slider; tomorrow it is a custom range bar; the day after it is the same range bar with a typed-number readout instead of a drag handle. Capabilities outlive implementations. The capability "the user can change the volume of part 5 to 80" persists across every implementation change; the test that asserts *"clicking at x-pixel 300 fires onValueCommit with 80"* lives and dies with the Radix slider.

The whole methodology follows from one rule: **all artifacts that define the product's behavior should bind to capabilities, not to implementations.** The product specification names capabilities. The test suite asserts capability invariants. The component library realizes capabilities. The workplan tracks capability deliveries. When a refactor changes implementation but preserves capabilities, no specification document needs to change, no test should fail, and the component library's external contract is intact. When a refactor changes capabilities — adds a new affordance, removes a deprecated one — the change shows up in the specification first, then in the tests, then in the implementation.

This is not a novel idea in software engineering. Test-driven development teaches the same lesson at the function level (test the contract, not the implementation). Interface-first design teaches the same lesson at the module level (consumers depend on interfaces, not concrete classes). Domain-driven design teaches the same lesson at the system level (model the domain, not the database). What is new here — and what we will spend the rest of this essay on — is the operationalization of the principle for GUIs specifically: the artifacts that make capability/implementation separation tractable when the codebase is React components, CSS files, and Playwright tests rather than back-end services.

---

## 3. Artifact 1: The Capability Inventory

The capability inventory is a single document that enumerates every distinct affordance the GUI offers. It is the source of truth for what the product does. It is not a feature list (which describes business value) or a user manual (which describes user-facing behavior in prose); it is a structured enumeration with a row per capability, where each row is identified by a stable ID and tracked across at least five columns:

| Column | Purpose |
|---|---|
| **ID** | A stable, opaque identifier (`D-CART-01`, `D-PROFILE-04`) that never changes even when the affordance is rephrased, restyled, or relocated |
| **Affordance description** | One-line description of what the user can do (e.g., "Add an item to the cart") |
| **Source-of-truth file:line** | Where the affordance is implemented today; updated when the implementation moves but the capability persists |
| **Status** | `implemented` / `partial` / `missing` / `removed` — the lifecycle stage |
| **Test citation** | The test file:line that asserts this capability is reachable and behaves correctly |

The inventory is not a one-time artifact. It is maintained as the product evolves. A new capability appears in the inventory before its implementation lands. A deprecated capability is marked `removed` rather than deleted, so the test that historically verified it can be unwound without losing the audit trail. A refactor that moves an affordance from one file to another updates the source-of-truth column without touching the ID.

The ID convention is load-bearing. Use a prefix that names the area of the product (`D-CART-` for shopping cart, `D-PROFILE-` for user profile, `D-CHECKOUT-` for checkout flow) followed by a number. The prefix should be terse but mnemonic so a test reader can grep `D-CART-` and find every cart-related test. The number is just a sequence; do not encode meaning in it. IDs should be assigned in birth order and never reused. When a capability is removed, its ID is retired permanently, marked `removed` in the inventory but never reassigned to a different affordance. This preserves the property that any historical reference to an ID still resolves correctly.

The status column needs five distinct values, not three:

- **`implemented`** — the capability exists, is reachable, has a test that verifies it
- **`partial`** — the capability exists but has known limitations (e.g., it works on desktop but not mobile)
- **`missing`** — the capability is in the design but has not been built yet
- **`removed`** — the capability used to exist but was retired
- **`planned`** (optional) — the capability is in the roadmap but not in the design yet

The reason to enumerate `partial` separately from `implemented` is that it forces honesty. A capability that works in 90% of cases but breaks in a known edge case is not "implemented"; calling it so teaches the team that 90% is acceptable. The `partial` status forces a follow-up: either complete it, or remove the remaining 10% from the user-facing experience, or document the limitation publicly. There should never be a long-lived `partial` row; it should resolve within a release cycle to `implemented` or `removed`.

The inventory's most important property is that it is **enumerable**. Every capability the product offers appears as a row. There is no "implicit" capability. If the team finds that some interaction works in production but does not appear in the inventory, that is a defect: either the inventory is incomplete (add the row) or the interaction is unintentional (remove it from the code). The inventory grows over time; that is correct. It does not shrink except by `removed` rows; that is also correct. A GUI's capability surface is its product specification, and the specification deserves a maintained document.

A well-tended capability inventory has secondary benefits beyond the technical methodology. It serves as the canonical document for product managers, designers, and customer support: "What can the product do?" has a precise answer. It feeds release notes: every new `implemented` row since the last release is something to announce. It feeds deprecation announcements: every new `removed` row is something to communicate. It feeds onboarding: new engineers can read the inventory to learn the product's surface area in hours rather than weeks.

The inventory is owned by the engineering team but reviewed by product and design. A row that engineers want to mark `removed` but that product wants to keep is a conversation; the inventory is where the conversation happens. A row that designers want to add but that engineers cannot reach with the current architecture is a planning conversation; the inventory is where that conversation happens too.

The investment to maintain an inventory is small if it is built into the engineering workflow: every pull request that adds or removes an affordance updates the inventory in the same change. The investment to build one from scratch on an existing product is larger but bounded: one engineer reading every page and listing every affordance, typically a week of effort for a medium-size product. The return is a permanent reduction in coordination cost — every future conversation about "what does the product do?" has a place to start.

---

## 4. Artifact 2: The Test-Name Protocol

The capability inventory tracks what the product does. The test-name protocol tracks what the product is verified to do. Together they form a closed loop: every `implemented` capability has a citation in the inventory pointing to a specific test, and every test starts with the ID of the capability it verifies.

The protocol is a single rule: **the name of every UI test begins with the capability ID it verifies, followed by a colon and a human-readable description.**

```ts
test('D-CART-01: clicking "Add to Cart" appends the SKU to the cart', ...)
test('D-CART-02: cart count badge increments when an item is added', ...)
test('D-CART-03: cart total updates with the item price', ...)
test('D-CHECKOUT-05: empty-cart state shows "Continue Shopping" CTA', ...)
```

The rule is simple, but its consequences are substantial. Once every test is named this way, the inventory's "test citation" column becomes mechanically maintainable: a script greps for `D-CART-01:` in the test corpus and emits the file:line where it lives. The grep is the authority; if the inventory's citation diverges from the actual test location, the script catches the discrepancy in CI or a pre-commit hook.

More importantly, the protocol makes **coverage auditable by inspection**. Open the inventory. For each row whose status is `implemented` or `partial`, the test citation column must not be empty. If it is, the capability has no test — a coverage gap. The audit is a grep, not an audit meeting. The audit happens every time someone opens the inventory; the friction of leaving a gap is high enough that gaps get filled.

The protocol also makes **refactoring safer**. When a developer migrates a button from one framework to another, they preserve the test name. The new test asserts the same capability via the new implementation. The test continues to live under `D-CART-01:`; the implementation underneath the test changes; the test's existence proves the capability survived the migration. If the developer cannot get the new implementation to pass `D-CART-01`, that is a real regression — the user-facing capability is broken — and the refactor cannot ship.

There are two failure modes to watch for, both of which the protocol forbids:

**Tests with non-capability prefixes.** A test named `"button renders with the correct class name"` does not bind to a capability; it binds to an implementation detail. The protocol exposes this: the test has no `D-` prefix, so it does not appear in any capability's citation, so a future refactor that changes the class name will break the test for no reason worth caring about. The remedy is to either (a) rename the test to bind to a capability (`D-CART-01: clicking Add to Cart adds the item`) or (b) delete the test as low-value coverage. The protocol forces the choice.

**Capabilities with no tests.** A row in the inventory with status `implemented` and an empty test citation is a coverage hole that the team has either acknowledged (an open follow-up issue) or ignored (a debt). The protocol surfaces these so they cannot be ignored silently.

A small additional convention is helpful: use prefixes consistently for different *kinds* of capabilities, not just different *areas*. The Roland sampler editor case study uses `D-` for displays (read-only affordances) and `C-` for contracts (compositional capabilities, like "this component exposes a `dataTestId` prop"). The distinction is useful because some tests verify what the user sees (`D-CART-02: cart count badge increments`) while others verify component contracts that don't have a user-visible side (`C-FORM-INPUT-02: focus-visible style is applied on keyboard focus`). Both are real and worth tracking; using different prefixes lets the inventory carry both kinds of rows without conflating them.

A team adopting the protocol on an existing project does not have to rename every test at once. The cheap path: when you touch a test for any reason — add a case, fix a flake, update an assertion — rename it then. Within a quarter most tests will be renamed; within two quarters the rest can be cleared in a one-day sweep. The protocol is most valuable once 100% of UI tests follow it, but it provides value at any percentage above 50%: that's the threshold where a grep-based audit becomes informative.

---

## 5. Artifact 3: The Atomic-Primitive Design System

The third artifact is the codebase analog of the inventory: a small, canonical set of UI primitives that every page consumes. The primitives are the atomic vocabulary the GUI is built from. A primitive is a *form-control class, a layout container, a typography rule, a state indicator* — small, composable, and shared. The design system is the totality of these primitives plus the design tokens (color, spacing, typography) they reference.

The crucial property of an atomic-primitive design system is **closure under page composition**. Every page in the GUI is built from primitives in the design system and nothing else. There are no per-page custom button styles. There are no inline `<input type="range">` controls without a corresponding `.slider` class from the design system. There are no per-feature CSS files that re-implement form-field chrome. A page is allowed to compose primitives in novel ways; it is not allowed to invent new primitives at the page level.

This rule is enforced not by code review (which is unreliable for design-system drift) but by grep audits:

```bash
# Find every form control that doesn't use a design-system class
grep -rn "<input type=" src/ | grep -v "className.*ac-input"
grep -rn "<select" src/ | grep -v "className.*ac-select"
```

A clean grep means the design system is the only primitive surface in the codebase. A grep with hits means a page has re-implemented a primitive — a nucleation site that will attract more drift. The grep runs in CI or a pre-commit hook; the team catches drift the same day it happens, not three releases later when the cleanup cost is prohibitive.

The composition pattern is important. Some primitives are pure CSS classes applied to native HTML elements (`<select class="ac-select">`, `<input type="text" class="ac-input">`); some are React components that compose multiple HTML elements (`<AcCheckbox>` rendering a `<label>` wrapping an `<input>` and a span); some are higher-order compositions (`<AcSlider>` rendering a label, an `<AcRangeBar>` visualization, and a configurable readout slot). The team makes a deliberate choice per primitive: if the primitive is a single element with styling, prefer the class; if the primitive requires multi-element composition, prefer the component; if the primitive needs to be customized by callers in well-defined ways, expose composition slots rather than props for every variation.

A few principles keep the design system small enough to be useful:

**One primitive per affordance kind.** There is one button primitive, not two. There is one slider primitive (which may have variants — linear, bipolar, enum — but they are variants of one primitive, not separate primitives). When a designer proposes a new primitive, the question is whether the existing primitives can be combined to produce the desired affordance; only if not, add a primitive.

**Modifiers, not new primitives, for variations.** A button can have `primary`/`secondary`/`danger`/`compact` modifiers without becoming four separate primitives. Modifiers are documented in the design-system reference (every modifier has a "when to use" note); they share the base primitive's accessibility and contract.

**Tokens, not literals.** Colors, spacing, typography sizes, border widths are all referenced via tokens (CSS custom properties). A primitive's CSS uses `var(--space-2)`, never `8px`; uses `var(--color-accent)`, never `#1e90ff`. Token changes propagate to every primitive; literal changes propagate to nothing.

**Documentation is part of the primitive.** Every primitive has a section in the design-system reference document covering: purpose, when to use, the markup or JSX example, related tokens, accessibility notes (focus behavior, ARIA contract, keyboard interactions). A primitive without documentation is a primitive that will be misused; a primitive with documentation is one that future engineers reach for instead of re-inventing.

The design system is the operational realization of the capability/implementation separation. The inventory's capabilities describe what users can do; the design system's primitives are the implementations that realize those capabilities. The decoupling is direct: when a primitive changes (e.g., the slider's visual treatment updates), every page consuming the primitive picks up the change through CSS cascade or component update without any per-page work. The change is one place; the propagation is automatic.

---

## 6. The Three-Track Verification Pattern

The three artifacts — inventory, test-name protocol, design system — define the *state* of a well-formed GUI codebase. The three-track verification pattern is the *process* that keeps the state intact when changes land.

The pattern has three layers, each catching a qualitatively different kind of regression:

**Track 1: Independent test re-run.** After any implementation change, the orchestrator (a human reviewer, a senior engineer, an AI controller — whoever is responsible for accepting the change) re-runs the load-bearing test gate themselves, in their own environment, before dispatching reviewers. The implementer's reported test output is a claim, not evidence. Re-running independently catches three failure modes: (a) the implementer reported numbers from a different commit (stale claim); (b) the implementer's environment diverges from the orchestrator's (environment drift); (c) the implementer fabricated the result (rare but possible, and impossible to rule out without independent verification). Track 1 is cheap: a 2-3 minute test run.

**Track 2: Spec compliance review.** A reviewer with the brief or specification on screen compares the diff to the spec line by line. The question is *did the implementation deliver exactly what was specified?* — not more, not less. This catches scope creep (the implementer added a feature that was not requested), scope drift (the implementer interpreted a vague spec in an unexpected way), and missing pieces (the implementer claimed completion of a 10-point spec but only delivered 8). The reviewer is given a checklist of acceptance criteria from the brief and ticks them off against the diff. Track 2 is medium-cost: 5-15 minutes of focused review.

**Track 3: Code quality review.** A different reviewer, with no brief or specification on screen, reads the diff for quality concerns: nucleation sites (patterns that will be copied incorrectly), contract leaks (type signatures that admit invalid states), discipline-rule violations (`// TODO`, `// for now`, `as any`), file-size cap excesses, accessibility regressions. The reviewer is not checking *did this match the spec* (Track 2's job) but *is this code that future engineers can safely build on?* — a different question with different signals. Track 3 is medium-cost: 5-15 minutes.

The pattern's power comes from the *independence* of the tracks. The implementer's confidence does not influence the test run (Track 1 is independent). The implementer's choice of phrasing for what they implemented does not influence the spec review (Track 2 reads the brief, not the implementer's report). The brief's framing does not influence the quality review (Track 3 reads the diff with no spec in hand). Each track has different blind spots; their union covers ground no single track covers.

The pattern was developed in response to a specific observation: in a CI-less environment, where automated checks do not exist between the implementer's claim and the merge, the orchestrator is the only structural check. A single review pass is not enough — it conflates spec compliance with code quality and routinely misses one or both. Separating them, and adding the independent test re-run, creates a triangulated verification surface that catches different regression classes at each layer.

The pattern is not free. It costs 15-30 minutes of additional reviewer time per implementer dispatch. It assumes the reviewers can be different humans (or, in an AI-assisted workflow, different agent invocations with different contexts and prompts). It assumes the team has the discipline to use it consistently — running Track 1 reliably regardless of how confident they are in the implementer.

The pattern's value over time: every regression caught at Track 1, 2, or 3 is a regression that does not compound into the next round of work. The cost-asymmetry is real and worth measuring: a nucleation-site pattern caught the day it lands costs minutes to fix; the same pattern caught after four more callsites have copied it costs hours. The pattern pays for itself the first time it catches something; every other time it is cheap insurance.

---

## 7. The Workplan as Defensive Contract

The capability inventory describes the GUI's *state*. The workplan describes the *path* the team will take to change that state. A well-formed workplan is a defensive contract: it is written to be hostile to incomplete work. Every task in the workplan should have an observable completion gate that an adversarial reader cannot satisfy with partial delivery.

The pattern has four principles:

**Principle 1: Every task has a "proven complete when" gate.** Not "tests pass" — that is a tautology. Not "the feature works" — that is not verifiable. A gate is observable: *"the inventory rows D-CART-05, 06, 07 all have non-empty test citations and a passing test under `npm test`"*. Or *"`grep -rn '<input type=\"range\"' src/` returns zero hits."* Or *"the file `cart-checkout-flow.spec.ts` exists, has at least 8 test blocks, and `npm test cart-checkout-flow` exits 0."* The gate's observability is what makes the task adversarially closeable: an outside reader looking at the workplan and the codebase can determine independently whether the gate is met.

**Principle 2: Cross-task dependencies are hard blocks.** "Task B depends on Task A" is binding. Task B's dispatch cannot start until Task A's gate is proven met. There is no loophole for "we can start B in parallel and circle back to A." The reason is that a partially-complete prerequisite produces a half-built dependent; the half-built dependent then attracts patches and workarounds that compound the original incompleteness. Hard blocks prevent the parallelization that looks productive in the moment but creates technical debt that survives the project.

**Principle 3: Deferral requires explicit acceptance.** A controller — the engineer or AI agent driving the work — cannot self-issue a deferral. "We will handle this in a follow-up issue" is not a valid disposition unless the operator (the human in charge of the project's direction) has explicitly accepted the deferral and the workplan has been updated to record it. Filing a GitHub issue without operator acceptance does not count as a deferral; it counts as a TODO comment. The principle catches the failure mode where a controller, under pressure to ship, silently moves work out of scope by filing an issue; the workplan no longer reflects what shipped.

**Principle 4: Status reports name what's NOT done as loudly as what is.** A task with three of five acceptance criteria met is not "mostly done" — it is at most "started." Reporting it as "done with caveats" trains the team (and the controller) to treat 60% as success. It is not. Honest status reports prevent the slow drift from "this is incomplete" to "this is acceptable."

These principles work together. The "proven complete when" gates make completion verifiable. The hard blocks prevent half-built prerequisites. The deferral discipline prevents silent scope reductions. The honest status reports prevent normalization of partial work. Together they make the workplan a contract that the team cannot satisfy through optimistic interpretation.

The workplan discipline is the slowest-moving of the three artifacts to adopt because it requires cultural buy-in, not just tooling. A team that has historically tolerated "deferred to follow-up" patterns will not adopt the discipline by reading a document; they will adopt it after a senior engineer or tech lead enforces it once or twice on real work and demonstrates that the cost of enforcement is lower than the cost of the patterns it prevents.

---

## 8. Worked Example: A Product-Page Redesign

Consider an e-commerce product page. The page has been in production for two years. It currently renders: product images (carousel), title and price, variant selector (color/size dropdowns), quantity selector (numeric stepper), add-to-cart button, customer reviews (paginated list with star ratings), related-products grid, and a sticky bottom-of-page CTA on mobile.

The team wants to redesign the page. The new design language uses a different color palette, different typography, a new variant-selector pattern (visual swatches instead of dropdowns), an updated review-rating component, and a redesigned mobile sticky-CTA pattern.

Without the methodology, the redesign would proceed roughly like this: a senior engineer creates a feature branch, ports the page to use the new design tokens, updates the components inline, runs the existing tests, fixes the tests that break, ships the PR. The PR is large (40+ files), the test diff is hard to review, the team merges based on visual inspection. Three weeks after merging, a customer complaint surfaces that the variant selector no longer respects out-of-stock states — a regression no one noticed because the test that should have caught it was bound to the old dropdown's DOM structure and was disabled during the migration as "no longer relevant."

With the methodology, the redesign proceeds differently. The team starts by writing or refreshing the capability inventory for the product page:

```
| ID            | Affordance                                       | Source-of-truth         | Status        | Test citation                              |
|---------------|--------------------------------------------------|--------------------------|---------------|--------------------------------------------|
| D-PROD-01     | Product images render in a carousel              | ProductPage.tsx:54       | implemented   | product-page.spec.ts: D-PROD-01            |
| D-PROD-02     | Carousel advances on swipe (mobile)              | ProductCarousel.tsx:88   | implemented   | product-page.spec.ts: D-PROD-02            |
| D-PROD-03     | Carousel advances on arrow keys (desktop)        | ProductCarousel.tsx:142  | implemented   | product-page.spec.ts: D-PROD-03            |
| D-PROD-04     | Product title, price, and savings render         | ProductInfo.tsx:28       | implemented   | product-page.spec.ts: D-PROD-04            |
| D-PROD-05     | Variant selector exposes color choices           | VariantSelector.tsx:72   | implemented   | variant-selector.spec.ts: D-PROD-05        |
| D-PROD-06     | Variant selector exposes size choices            | VariantSelector.tsx:104  | implemented   | variant-selector.spec.ts: D-PROD-06        |
| D-PROD-07     | Out-of-stock variants are disabled (not hidden)  | VariantSelector.tsx:135  | implemented   | variant-selector.spec.ts: D-PROD-07        |
| D-PROD-08     | Quantity stepper accepts 1–99, default 1         | QuantityStepper.tsx:24   | implemented   | quantity-stepper.spec.ts: D-PROD-08        |
| D-PROD-09     | Add-to-cart button fires `addToCart` on click    | AddToCartButton.tsx:18   | implemented   | add-to-cart.spec.ts: D-PROD-09             |
| D-PROD-10     | Add-to-cart is disabled when no variant selected | AddToCartButton.tsx:32   | implemented   | add-to-cart.spec.ts: D-PROD-10             |
| D-PROD-11     | Customer reviews paginate (10 per page)          | ReviewsSection.tsx:48    | implemented   | reviews-section.spec.ts: D-PROD-11         |
| D-PROD-12     | Star rating averages display to 1 decimal place  | ReviewsSection.tsx:64    | implemented   | reviews-section.spec.ts: D-PROD-12         |
| D-PROD-13     | Sticky CTA appears on mobile after scrolling     | MobileStickyCta.tsx:14   | implemented   | mobile-cta.spec.ts: D-PROD-13              |
| ... 17 more rows                                                                                                                                                |
```

The inventory has 30 rows. Each row identifies an affordance the page currently delivers. The team reviews the inventory: every row's affordance description is what the user can do; the source-of-truth column points to where it is implemented today; the test citation points to a test that asserts it works.

Now the redesign work begins. The team's first step is to update the inventory: which capabilities are changing? In this case, three rows change:

- `D-PROD-05` (color selector) — the affordance persists ("user can pick a color") but the implementation changes (dropdown → visual swatches)
- `D-PROD-06` (size selector) — same shape: affordance persists, implementation changes
- `D-PROD-12` (star rating) — same affordance, new visual treatment

No row is removed. No row is added (the redesign does not change *what* the page can do — it changes *how* it presents). The team marks `source-of-truth` to refer to the future state file path (which may not exist yet); the status stays `implemented`; the test citation stays pointing at the existing test.

The team then refactors each affected row's implementation. They write the new `VariantSelector` component that uses visual swatches. The existing test `variant-selector.spec.ts: D-PROD-05` runs against the new implementation. If the test passes, the capability survived the refactor. If the test fails, the team has a regression to address — either fix the implementation or update the test (carefully — updating a test to match a regression is the failure mode the methodology exists to prevent).

The test for `D-PROD-07` ("out-of-stock variants are disabled, not hidden") is particularly load-bearing. The new visual-swatch implementation needs to render out-of-stock swatches as visually distinct, non-clickable but still visible. The original dropdown implementation rendered them as `<option disabled>`. The test does not care about the DOM shape; it cares about the behavior: *given a product with an out-of-stock variant, the variant appears in the selector and clicking it does not change the selected variant*. The test asserts that behavior via `getByRole('option', { name: /red/i })` and a click + state-check, not via `querySelector('option:disabled')`. The test is durable across the refactor.

The redesign ships when every test in the inventory's test-citation column passes against the new implementation. The PR is large in line count but small in semantic surface: the affordances did not change; only their implementations did. A reviewer looking at the diff can confirm that every capability is still delivered by reading the test names — `D-PROD-01`, `D-PROD-02`, ... `D-PROD-30` — and confirming each still passes. The visual inspection is no longer the load-bearing review; the test suite is.

The methodology converts a high-risk redesign into a structured set of low-risk refactors. The risk reduction comes from the capability/implementation separation: refactors only change implementations, so they cannot break capabilities; the test suite asserts capabilities, so refactors that pass tests cannot regress user-facing behavior.

---

## 9. When This Methodology Doesn't Apply

The methodology has real costs and real preconditions. It does not fit every project.

**Greenfield projects where the capability surface is still being discovered.** The methodology assumes the team can enumerate the GUI's capabilities. If the product is still in early-stage exploration — where the right affordances have not yet been settled, where the design is changing weekly, where the engineering team is still discovering what the product should be — the inventory will churn faster than it stabilizes, and the cost of maintaining it will exceed the benefit. In this phase the project should optimize for *change speed* over *change safety*. Adopt the methodology once the capability surface stabilizes; until then, lightweight smoke tests and visual inspection are appropriate.

**Tiny projects where overhead exceeds value.** The methodology has overhead: the inventory itself, the test-name protocol, the design system, the verification pattern. On a 500-line single-page tool that two engineers maintain, the overhead may exceed the benefit. The threshold is roughly: if the team has ever shipped a regression that the test suite did not catch, and if the cost of that regression was real, the methodology starts to pay for itself. For projects that have not yet reached that threshold, simpler approaches (manual testing, sparse smoke tests, visual review) are appropriate.

**Projects without clear capability boundaries.** Some GUIs are not built around capabilities in a meaningful sense — purely creative tools (a drawing app, a generative-art editor), real-time data visualization tools where the interaction is continuous rather than discrete, games where the player's action space is open-ended. These projects have surface area that resists enumeration. The methodology's inventory-driven approach will produce either an artificially-narrow inventory (omitting the actual behavior) or an artificially-wide one (every pixel a row). Other testing methodologies — property-based testing, user-study-driven verification, performance-and-rendering verification — fit better.

**Projects without a test culture.** The methodology depends on a test suite that is taken seriously: tests that run on every PR, that are not skipped routinely, that are maintained when they break. A team that does not have a test culture will not get value from the methodology; they will get value first from establishing the test culture and then layering this methodology on top. Order matters.

**Projects with no design-system investment.** The third artifact — the atomic primitive design system — requires an actual design system to exist or to be willing to build one. A project where every page rolls its own visual language cannot adopt the design-system part of the methodology without first building the design system. That is fine; the inventory and test-name protocol have value on their own and can be adopted independently. The design-system rule will come later when the team has invested in the primitives.

The methodology, like most engineering methodologies, has a fitness landscape. It fits products that are mid-to-late lifecycle, are growing in complexity, and have a team large enough to benefit from explicit coordination artifacts. It does not fit products at the very beginning or the very end of their lifecycle, nor products with fundamentally non-enumerable interaction surfaces.

---

## 10. How to Retrofit

A team starting from scratch can adopt the methodology by building all three artifacts before writing the first feature. A team retrofitting onto an existing project must take it in stages. The bootstrap path:

**Stage 1 — Build the capability inventory.** Walk every page of the product. List every affordance. Assign IDs. Mark the status column based on the current state. Do not write or change any code in this stage; the goal is to produce a complete enumeration. For a medium-size product (50–200 capabilities) this is roughly one engineer-week. The inventory does not need to be perfect; the second iteration improves it. The first iteration's value is that the document exists and the team has a shared view of the product's surface.

**Stage 2 — Adopt the test-name protocol on touched tests.** Do not rename every test at once. The next time a test is touched (a new case added, a flake fixed, an assertion updated), rename it to match the test-name protocol. Within a quarter, most tests will be renamed; within two quarters, a half-day sweep can clear the rest. During the transition, the inventory's test-citation column may be incomplete; that is acceptable as long as the trajectory is toward completeness.

**Stage 3 — Build (or extract) the design-system primitives.** Identify the most-used affordance kinds in the product (buttons, form fields, list items, modals). For each, define the canonical primitive. Migrate the most-trafficked pages first; the long tail of seldom-touched pages can migrate opportunistically when next touched. The migration is per-primitive, not per-page: when the button primitive ships, every page that consumes it picks up the new visual treatment automatically.

**Stage 4 — Adopt the verification pattern on high-risk changes.** Not every PR needs three-track verification. The team adopts the pattern on changes that touch the design system, change capability-bound behavior, or migrate implementations. Routine bug fixes can ship with single-track review. The pattern is a tool for high-leverage changes, not every change.

**Stage 5 — Adopt the workplan discipline on the next significant initiative.** When the team next plans a feature, refactor, or redesign of meaningful scope, write the workplan with the "proven complete when" gates, the hard blocks, and the deferral discipline. The first time is awkward; by the second or third the team's reflexes adjust.

The stages are sequential because each builds on the previous. The inventory has to exist before the test-name protocol has anything to bind to. The protocol has to exist before the verification pattern has tests to verify. The design system has to exist before the verification pattern can catch design-system drift. The workplan discipline operates on the rest.

The total adoption time is on the order of a quarter for a small team, two quarters for a medium team. The benefits begin accruing from Stage 1: even with only the inventory in hand, the team has reduced coordination cost by an order of magnitude. The full value compounds after all five stages are in place.

---

## Appendix: A Sampler-Editor Case Study

The methodology described in this essay was developed and refined during a redesign of a web-based editor for a vintage Roland S-330/S-550 sampler. The case study is included not because the domain (vintage hardware MIDI editors) is broadly relevant, but because the project's specific shape exercised every layer of the methodology under realistic constraints.

The editor's responsibilities: communicate with a 1988-era sampler over SysEx MIDI, fetch and render its internal state (tones, patches, samples, performance settings, library contents), edit parameters in real time, save/load library sets, drag-and-drop between library and device memory. The codebase: ~100K lines of TypeScript across a monorepo with shared editor infrastructure and per-device modules. The team: one full-time engineer with AI assistance.

**The inventory.** The capability inventory for the editor lives at `ROLAND-S550-EDITOR-CAPABILITIES-DETAILED.md` and enumerates 183 affordances across the editor's surface. IDs use a two-character area prefix (`D-PATCH-01`, `D-TONE-WAVE-09`, `D-LIB-08`, `D-XX-11` for cross-cutting affordances like the MIDI Panic button). Each row tracks: ID, affordance description, source-of-truth file:line, contract ID (`C-PATCH-04` for the patch editor's compositional contract), origin (native to the device protocol vs. editor-derived UX), status, and test citation. The inventory was built before the redesign began; it served as the contract that the redesign had to satisfy.

**The test-name protocol.** All 146 UI tests in the editor's capability suite start with the capability ID they verify. Examples: `test('D-PATCH-01: clicking a patch slot selects it', ...)`, `test('D-TONE-WAVE-09: changing the wave bank emits the correct DT1 SysEx', ...)`, `test('D-LIB-08: dropping a library tone onto a device slot mounts ImportLibraryToneDialog', ...)`. The protocol made coverage auditable: a grep `grep -rn "test('D-" test/ui/capabilities/` returns every capability-bound test, and a script cross-references the inventory to find any `implemented` or `partial` row without a citation. Phase 0 Task 10's acceptance gate was *"every `implemented` or `partial` capability has a non-empty test citation"* — a grep-checkable condition that the team could close decisively.

**The design system.** The editor's design system is documented in `DESIGN-SYSTEM.md` and lives at the CSS + React component layer. Primitives include `.ac-page`, `.ac-page-shell`, `.ac-btn`, `.ac-input`, `.ac-select`, `.ac-checkbox` (as `<AcCheckbox>`), `.ac-slider` + `.ac-range-bar` (as `<AcSlider>` and `<AcRangeBar>`), `.ac-number-input` (as `<AcNumberInput>`), and `.ac-envelope` (as `<AcEnvelope>` with three sub-components for the visualization, the meta-pip rows, and the per-segment table). The primitives reference design tokens (`--ac-space-2`, `--ac-color-accent`, `--ac-text-eyebrow`) defined in `tokens.css`. Variants and modifiers (`.ac-select--compact`, `.ac-input--error`, `.ac-input--warning`) extend the base primitives without forking them.

**The three-track verification pattern.** The pattern emerged from a specific constraint: the project had previously run CI but the operator decided to remove it ("we are not going to invest in CI test runners. That's a waste of time for a nascent project"). Without CI, the trust gap between an implementer's reported test output and the actual repository state was unbridged. The pattern's three layers — independent test re-run by the orchestrator + spec-compliance reviewer (focused on brief vs. diff) + code-quality reviewer (focused on diff vs. project standards) — covered the gap. Across the redesign's 13 implementation commits, the pattern caught: three keyboard-accessibility gaps in the envelope primitive's sub-components, a nucleation-site pattern where new scenarios inlined a mount prelude instead of calling the existing helper, a contract leak where the AcCheckbox component could not forward `data-testid` to the underlying input, a regression where a dialog's progress bar displayed fabricated byte counts because the data source emitted percentages. Every catch was at a different layer of the pattern; the layers were independently necessary.

**The workplan as defensive contract.** The redesign's workplan was rewritten mid-project after a "shell-partial" trap was caught: two pages had shipped with polished outer chrome and vanilla browser controls inside; the controller had accepted them as "page complete." The post-incident reform added four rules to the project's `agent-discipline.md`: *"Just for now is bullshit"*, *"Drive every effort to completion before starting the next"*, *"Workplan integrity — rewrite defensively, never optimistically"*, *"When CI is absent, the controller is the gate"*. Each rule encoded a specific failure mode the team had seen and chose not to tolerate. The rules turned the workplan into a contract that an outside reader could not satisfy through optimistic interpretation: every task carried a *"proven complete when"* gate with observable artifacts (specific tests, file:line citations, grep audits); cross-task dependencies were hard blocks; "filed as a follow-up issue" was not a valid disposition without explicit operator acceptance.

**The outcome.** The redesign migrated 21 Radix-based parameter sliders, 27 vanilla form controls, two custom envelope editors, and the entire dialog family across 6 pages and 11 dialogs. The implementation work spanned 13 commits over one focused session. Through every commit, the UI capability test suite held flat at 146 passing tests; the editor-core unit test suite grew from 268 to 285 (the new tests covered primitive contracts that did not exist before). Zero regressions shipped to the main branch. Every quality finding from the verification pattern was caught and fixed in-session, before the next commit landed. The methodology held under real constraints — limited engineering hours, no CI safety net, a high-churn codebase, an operator driving turn-by-turn through `/implement` invocations — and delivered a redesign with verifiable behavioral preservation.

The case study's lessons that generalize beyond the specific domain:

- The inventory's stable IDs survive every refactor. The test names survived; the source-of-truth file paths moved as code reorganized; the IDs themselves did not change. Stability at the ID layer is what makes everything else durable.
- The atomic-primitive design system makes per-page polish almost mechanical. Once `AcCheckbox` exists with `dataTestId` and `forwardRef`, every consuming page is a class swap or component import; the team is not designing per page, only consuming the same design everywhere.
- The verification pattern's value is the *independence* of the tracks. The same person doing all three tracks would not catch the regressions that different-context reviewers catch. AI-assisted workflows benefit from this property especially: different agent invocations have genuinely different contexts.
- The workplan discipline is the slowest-moving artifact to adopt because it requires cultural buy-in. The rules in `agent-discipline.md` were written after specific failures; each rule has a footnote tying it to the incident that motivated it. The discipline is durable because the failures it prevents are remembered.

The methodology is not domain-specific; the domain is just where it was sharpened. The artifacts — inventory, test-name protocol, design system, verification pattern, workplan discipline — generalize to any GUI codebase where capabilities are enumerable and the team values change-safety over change-speed.
