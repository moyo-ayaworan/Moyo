# Regional selling prices and currency display

Public shop and homepage product prices use the visitor's Vercel country header to choose a display currency. Visitors can override it with the currency selector; the choice persists in local storage. Unmapped countries use USD, and missing country information uses NGN.

ExchangeRate-API supplies daily NGN conversion estimates, cached server-side for 24 hours. Invalid or more than three-day-old rates fall back to NGN. Country-specific responses are private and not cached by shared clients. The selector includes provider attribution and explains that bank conversion rates and fees can differ.

Europe (including the UK) and USA use twice the base selling price. Africa and all other regions retain the base price. The server uses the Vercel country header for new shop and Stillbounds orders; a currency selection never changes the selling-price tier. Existing order amounts are preserved on retries. Missing country information uses the base tier. IP location is approximate and VPNs may change the detected region.

Currency conversion changes presentation only. Paystack checkout and server-owned order amounts remain NGN. The purchase form shows the exact NGN charge. No converted amount or display preference is submitted as a payment amount. Stillbounds offers and account pages use the same regional amount as checkout. Bespoke booking invoices retain the amount set by the studio.


## Rounded USD selling prices

Only USD selling prices round the base NGN conversion up to the next $10, then apply the region multiplier. For example, at 0.000739 USD/NGN, Stillbounds is $30 in the base tier and $60 in Europe/USA. Existing NGN prices and other currency conversions retain their prior rules.

Paystack still charges NGN. The browser shows the NGN quote before payment; both checkout backends independently fetch validated rates and compute the charge. Client-supplied expected amounts must match the server calculation for USD. Missing/stale rates or changed quotes stop checkout rather than silently charging another price. Existing payment orders retain their saved amount; incompatible retries must check the original checkout first. Shop order metadata records the USD selling price. Actual bank conversion rates and fees can differ from the quote.
