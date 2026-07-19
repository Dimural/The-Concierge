// Live Stay22 Direct Travel API access + response mapping.
// Endpoints/params/headers per https://dev.stay22.com/docs/api (fetched
// 2026-07-18): base https://api.stay22.com, GET /v2/accommodations for
// property search (X-API-KEY header, lat/lng/radius/checkin/checkout/adults/
// rooms/currency/pageSize params, results carry `suppliers.<name>.link` deep-
// links that already embed the `aid` tracking param), GET
// /v1/reporting/transactions for attributed bookings (X-API-KEY header,
// thirdParty/format/dateFilter/page/limit params, rows carry campaignId /
// campaignIds). Never having a real key to test against, every accessor here
// is null-safe: a shape mismatch degrades to `null`/`[]` rather than throwing,
// so the caller always has a clean fallback path.
import { DEFAULTS } from '../src/data/royal-york-fallback.js';

const STAY22_BASE = 'https://api.stay22.com';
const HOTEL_LAT = 43.6455;
const HOTEL_LNG = -79.3806;
const REQUEST_TIMEOUT_MS = 8000;

const SUPPLIER_LABELS = {
  booking: 'Booking.com',
  bookingcom: 'Booking.com',
  expedia: 'Expedia',
  hotelscom: 'Hotels.com',
  vrbo: 'Vrbo',
};

function pad2(n) {
  return String(n).padStart(2, '0');
}

function toISODate(d) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

export function computeStayWindow(nights = 2, leadDays = 30) {
  const checkinDate = new Date();
  checkinDate.setDate(checkinDate.getDate() + leadDays);
  const checkoutDate = new Date(checkinDate.getTime());
  checkoutDate.setDate(checkoutDate.getDate() + nights);
  return { checkin: toISODate(checkinDate), checkout: toISODate(checkoutDate) };
}

function prettifySupplier(key) {
  if (typeof key !== 'string' || !key.length) return key;
  const label = SUPPLIER_LABELS[key.toLowerCase()];
  if (label) return label;
  return key[0].toUpperCase() + key.slice(1);
}

function deriveCity(address) {
  if (typeof address !== 'string' || !address.length) return null;
  const parts = address.split(',').map((s) => s.trim()).filter(Boolean);
  return parts.length >= 2 ? parts[parts.length - 2] : null;
}

function appendAid(url, campaign) {
  if (typeof url !== 'string' || !url.length) return null;
  try {
    const u = new URL(url);
    if (!u.searchParams.has('aid')) u.searchParams.set('aid', campaign);
    return u.toString();
  } catch {
    return url;
  }
}

async function fetchJsonWithTimeout(url, headers) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(url, { headers, signal: controller.signal });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

// Defensive mapping: response-model field names per
// https://dev.stay22.com/docs/api/concepts/response-model, best-effort since
// exact wrapper keys aren't fully documented (tries `results`, falls back to
// other plausible container keys).
export function mapAccommodationsResponse(json, { campaign, checkin, checkout }) {
  const results =
    json?.results ?? json?.accommodations ?? json?.data ?? (Array.isArray(json) ? json : []);
  if (!Array.isArray(results) || results.length === 0) return null;

  const match =
    results.find((r) => typeof r?.name === 'string' && /royal york/i.test(r.name)) ?? results[0];
  if (!match) return null;

  const suppliersObj = match?.suppliers && typeof match.suppliers === 'object' ? match.suppliers : {};
  const supplierKeys = Object.keys(suppliersObj).filter((k) => suppliersObj[k]);
  const prices = supplierKeys
    .map((k) => suppliersObj[k]?.price?.total)
    .filter((v) => typeof v === 'number' && Number.isFinite(v));
  const price = prices.length ? Math.min(...prices) : null;
  const linkFromSupplier = supplierKeys
    .map((k) => suppliersObj[k]?.link)
    .find((v) => typeof v === 'string' && v.length);

  const lat =
    typeof match?.location?.coordinates?.lat === 'number' ? match.location.coordinates.lat : HOTEL_LAT;
  const lng =
    typeof match?.location?.coordinates?.lng === 'number' ? match.location.coordinates.lng : HOTEL_LNG;

  return {
    live: true,
    fetchedAt: Date.now(),
    property: {
      name: typeof match?.name === 'string' ? match.name : null,
      type: typeof match?.type === 'string' ? match.type : null,
      address: typeof match?.location?.address === 'string' ? match.location.address : null,
      city: deriveCity(match?.location?.address),
      rating: typeof match?.rating?.value === 'number' ? match.rating.value : null,
      reviewCount: typeof match?.rating?.count === 'number' ? match.rating.count : null,
      stars: typeof match?.rating?.hotelStars === 'number' ? match.rating.hotelStars : null,
      lat,
      lng,
    },
    market: {
      price,
      currency: typeof json?.meta?.currency === 'string' ? json.meta.currency : null,
      nights: typeof json?.meta?.nights === 'number' ? json.meta.nights : null,
      checkin: json?.meta?.checkin ?? checkin ?? null,
      checkout: json?.meta?.checkout ?? checkout ?? null,
      supplierCount: supplierKeys.length || null,
      suppliers: supplierKeys.length ? supplierKeys.map(prettifySupplier) : null,
    },
    policy: {
      freeCancellation:
        typeof match?.policies?.freeCancellation === 'boolean' ? match.policies.freeCancellation : null,
      instantBooking:
        typeof match?.policies?.instantBook === 'boolean' ? match.policies.instantBook : null,
      maxGuests: typeof match?.capacity?.guests === 'number' ? match.capacity.guests : null,
    },
    campaign,
    bookingLink: linkFromSupplier ? appendAid(linkFromSupplier, campaign) : null,
  };
}

export async function fetchLiveSession({ apiKey, campaign }) {
  if (!apiKey) return null;
  const { checkin, checkout } = computeStayWindow();
  const params = new URLSearchParams({
    lat: String(HOTEL_LAT),
    lng: String(HOTEL_LNG),
    radius: '600',
    checkin,
    checkout,
    adults: '2',
    rooms: '1',
    currency: 'CAD',
    pageSize: '5',
  });
  const url = `${STAY22_BASE}/v2/accommodations?${params.toString()}`;
  const json = await fetchJsonWithTimeout(url, { 'X-API-KEY': apiKey, accept: 'application/json' });
  if (!json) return null;

  const mapped = mapAccommodationsResponse(json, { campaign, checkin, checkout });
  if (mapped && !mapped.bookingLink) {
    mapped.bookingLink = appendAid(
      `https://www.stay22.com/search?address=${encodeURIComponent(DEFAULTS.property.address)}&checkin=${checkin}&checkout=${checkout}`,
      campaign,
    );
  }
  return mapped;
}

// Transactions endpoint: exact `thirdParty` semantics aren't documented past
// "platform identifier", so we pass the campaign id as a best-effort value.
// Every record is re-sanitized by the caller regardless of what comes back.
export async function fetchLiveTransactions({ apiKey, campaign }) {
  if (!apiKey) return [];
  const params = new URLSearchParams({
    thirdParty: campaign,
    format: 'json',
    dateFilter: 'bookedDate',
    limit: '200',
  });
  const url = `${STAY22_BASE}/v1/reporting/transactions?${params.toString()}`;
  const json = await fetchJsonWithTimeout(url, { 'X-API-KEY': apiKey, accept: 'application/json' });
  if (!json) return [];

  const rows = Array.isArray(json) ? json : (json?.rows ?? json?.transactions ?? json?.data ?? []);
  if (!Array.isArray(rows)) return [];

  return rows
    .filter((r) => {
      const ids = r?.campaignIds;
      return r?.campaignId === campaign || (Array.isArray(ids) && ids.includes(campaign));
    })
    .map((r) => ({
      id: String(r?.bookingId ?? `${r?.provider ?? 'txn'}-${r?.bookedDate ?? Date.now()}`),
      campaign,
      at: r?.bookedDate ?? r?.lastUpdatedDate ?? new Date().toISOString(),
      simulated: false,
    }));
}
