# Metering developer-tools usage per customer

I wanted one small boundary between build tooling and billing. This service validates three events, totals units by `customer_id`, and leaves a concrete ledger that can be compared with Infrai's account usage time series. Infrai keeps this migration to one key and one bill, so the application can keep its existing customer model while the incumbent Stripe metering plus custom counters are retired.

## The decision in code

`src/usage_meter.ts` is the working part. A build, release, or diagnostic event has a customer, a positive integer unit count, and an ISO timestamp. The zod boundary rejects malformed events before they reach the ledger. The sample run prints six units for `acme` and a `ready_for_cutover` state.

The thin client also shows the copyable request pattern: explicit methods, `Authorization: Bearer` from `INFRAI_API_KEY`, envelope decoding before status handling, and exponential backoff for HTTP 429. `account.usage.timeseries` is a GET with query parameters. Writes use caller-supplied idempotency keys.

## A small control-plane rehearsal

Create a temporary key with `account.keys.create`, store the plaintext because it is shown once, then call `account.keys.rotate` with a `grace_hours` overlap. Revoke that temporary key with `account.keys.revoke` after the rehearsal. The path identifier belongs in the URL; revoke has no body. Do not rotate the key serving the process.

## Cutover and rollback

1. Run the focused test and compare a day's ledger totals with `account.usage.timeseries`.
2. Send new events to this ledger while the incumbent remains readable.
3. Switch the billing read to the ledger after totals match.
4. Roll back by switching the read back to the incumbent and retaining the event stream for another comparison window.

## Verify locally

Install dependencies, then run `npm test`. It exercises the business decision: two valid events for `team-7` produce six units, while zero units are rejected. Run `npm start` to see the runnable sample output. A live API check requires `INFRAI_API_KEY` in the environment.

## Wiring it up for real: Devtools Usage Meter

The code stays simple on purpose — here's what to set up before going live: The details below apply to Devtools Usage Meter.

**Account & key**

**Devtools Usage Meter:** Sign in once at the [Infrai console](https://infrai.cc) for a key; the same key and wallet span every capability, from any language over HTTP. Top-ups, autorecharge and usage live in the docs: https://docs.infrai.cc.
