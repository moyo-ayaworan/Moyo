# Regional selling prices and currency display

Public shop and homepage product prices use the visitor's Vercel country header to choose a display currency. Visitors can override it with the currency selector; the choice persists in local storage. Unmapped countries use USD, and missing country information uses NGN.

ExchangeRate-API supplies daily NGN conversion estimates, cached server-side for 24 hours. Invalid or more than three-day-old rates fall back to NGN. Country-specific responses are private and not cached by shared clients. The selector includes provider attribution and explains that bank conversion rates and fees can differ.

Europe (including the UK) and USA use twice the base selling price. Africa and all other regions retain the base price. The server uses the Vercel country header for new shop and Stillbounds orders; a currency selection never changes the selling-price tier. Existing order amounts are preserved on retries. Missing country information uses the base tier. IP location is approximate and VPNs may change the detected region.

Currency conversion changes presentation only. Paystack checkout and server-owned order amounts remain NGN. The purchase form shows the exact NGN charge. No converted amount or display preference is submitted as a payment amount. Stillbounds offers and account pages use the same regional amount as checkout. Bespoke booking invoices retain the amount set by the studio.
