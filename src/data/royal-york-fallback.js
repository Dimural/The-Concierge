// Bundled fallback snapshot for the Fairmont Royal York, Toronto.
// Used whenever there is no STAY22_API_KEY, the live Stay22 call fails on the
// server, or the browser can't reach the server at all. Always marks
// `live: false`. Pure data/logic module — safe to import from node (server)
// or the browser bundle (client fallback); no window/document access.

export const DEFAULT_CAMPAIGN = 'concierge-royal-york';

export const DEFAULTS = Object.freeze({
  property: Object.freeze({
    name: 'The Fairmont Royal York',
    type: 'hotel',
    address: '100 Front St W, Toronto, ON M5J 1E3',
    city: 'Toronto',
    rating: 8.8,
    reviewCount: 9400,
    stars: 4,
    lat: 43.6455,
    lng: -79.3806,
  }),
  market: Object.freeze({
    price: 1050,
    currency: 'CAD',
    nights: 2,
    supplierCount: 4,
    suppliers: Object.freeze(['Booking.com', 'Expedia', 'Hotels.com', 'Vrbo']),
  }),
  policy: Object.freeze({
    freeCancellation: true,
    instantBooking: true,
    maxGuests: 4,
  }),
});

function pad2(n) {
  return String(n).padStart(2, '0');
}

function toISODate(d) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

// ~30 days out, a short stay — matches the server's live-search window so the
// fallback "feels" like a real quote even with no key.
export function computeStayDates(now = new Date()) {
  const checkinDate = new Date(now.getTime());
  checkinDate.setDate(checkinDate.getDate() + 30);
  const checkoutDate = new Date(checkinDate.getTime());
  checkoutDate.setDate(checkoutDate.getDate() + DEFAULTS.market.nights);
  return { checkin: toISODate(checkinDate), checkout: toISODate(checkoutDate) };
}

// Stay22 deeplinks carry an `aid` query param that ties the booking back to
// the campaign for attribution (see dev.stay22.com/docs/api). Without a live
// supplier link (no key), we construct a plausible tracked search deeplink.
export function buildBookingLink(campaign, checkin, checkout) {
  const params = new URLSearchParams({
    address: DEFAULTS.property.address,
    checkin,
    checkout,
    adults: '2',
    aid: campaign,
  });
  return `https://www.stay22.com/search?${params.toString()}`;
}

export function getFallbackSession(campaign = DEFAULT_CAMPAIGN) {
  const { checkin, checkout } = computeStayDates();
  return {
    live: false,
    fetchedAt: Date.now(),
    property: { ...DEFAULTS.property },
    market: {
      price: DEFAULTS.market.price,
      currency: DEFAULTS.market.currency,
      nights: DEFAULTS.market.nights,
      checkin,
      checkout,
      supplierCount: DEFAULTS.market.supplierCount,
      suppliers: [...DEFAULTS.market.suppliers],
    },
    policy: { ...DEFAULTS.policy },
    campaign,
    bookingLink: buildBookingLink(campaign, checkin, checkout),
  };
}
