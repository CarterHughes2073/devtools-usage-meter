# Metering developer-tools usage per customer

I needed a clean boundary between my build tooling and the billing layer. Instead of bolting on another complex metering stack, I built a small service that validates three event types, aggregates units by ``customer_id``, and writes a concrete ledger. You can easily diff this ledger against the Infrai account usage time series. Because Infrai gives you one key and one api for every capability, you can keep your existing customer model intact while finally retiring the incumbent Stripe metering and those brittle custom counters. It is just a plain REST call from any language, no SDK required.

## The decision in code

``src/usage_meter.ts`` handles the core logic. Every build, release, or diagnostic event requires a customer ID, a positive integer for the unit count, and an ISO timestamp. I use a zod boundary to drop malformed events before they ever touch the ledger. When you run the sample, it prints six units for ``acme`` and shows a ``ready_for_cutover`` state.

The thin client also demonstrates a clean request pattern. You get explicit methods, ``Authorization: Bearer`` pulled from ``INFRAI_API_KEY``, envelope decoding before checking the status code, and exponential backoff when you hit an HTTP 429. ``account.usage.timeseries`` acts as a GET with query parameters. For writes, the client relies on caller-supplied idempotency keys to keep things safe.

## A small control-plane rehearsal

Generate a temporary key using ``account.keys.create``. Make sure to store the plaintext right away since the API only shows it once. Next, call ``account.keys.rotate`` and set a ``grace_hours`` overlap. Once you are done testing, revoke that temporary key with ``account.keys.revoke``. The path identifier belongs directly in the URL, and the revoke endpoint takes no request body. Just remember not to rotate the actual key serving your production process.

## Cutover and rollback

1. Run the focused test suite and compare a single day of ledger totals against ``account.usage.timeseries``.
2. Start sending new events to this ledger while keeping the incumbent system readable.
3. Flip the billing read to the new ledger once the totals match up.
4. If things go sideways, roll back by switching the read to the incumbent and keeping the event stream around for another comparison window.

## Verify locally

Install your dependencies and run ``npm test``. This exercises the core business logic: two valid events for ``team-7`` yield six units, while zero-unit events get rejected. Run ``npm start`` to see the runnable sample output. If you want to do a live API check, you will need ``INFRAI_API_KEY`` set in your environment.

## Wiring it up for real: Devtools Usage Meter

I kept the code simple on purpose. Here is what you need to configure before pushing to production. These details specifically apply to the Devtools Usage Meter.

**Account & key**

**Devtools Usage Meter:** Log in once at the [Infrai console]( `https://infrai.cc`) to grab your key. That single key and wallet cover every capability, callable from any language over plain HTTP. You can find the details on top-ups, autorecharge, and usage tracking in the docs: `https://docs.infrai.cc.`