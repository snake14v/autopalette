// Service catalog — encoded VERBATIM from docs/APP_SPEC.md "Service catalog" section.
// startingPrice is intentionally left undefined; admin fills it in later.
// UI must show "priced on inspection" whenever startingPrice is absent.

export type ServiceCategory =
  | 'Protection'
  | 'Detailing'
  | 'Body Shop'
  | 'Wraps & Styling'
  | 'Accessories';

export interface ServiceCatalogEntry {
  id: string;
  label: string;
  category: ServiceCategory;
  startingPrice?: number;
}

export const CATEGORIES: ServiceCategory[] = [
  'Protection',
  'Detailing',
  'Body Shop',
  'Wraps & Styling',
  'Accessories',
];

export const SERVICE_CATALOG: ServiceCatalogEntry[] = [
  // Protection
  { id: 'ppf-full-body', label: 'PPF — Full Body', category: 'Protection' },
  { id: 'ppf-front-package', label: 'PPF — Front Package', category: 'Protection' },
  { id: 'ppf-individual-panels', label: 'PPF — Individual Panels', category: 'Protection' },
  { id: 'ceramic-coating', label: 'Ceramic Coating', category: 'Protection' },
  { id: 'graphene-coating', label: 'Graphene Coating', category: 'Protection' },
  { id: 'underbody-coating', label: 'Underbody Coating', category: 'Protection' },
  { id: 'anti-rust-treatment', label: 'Anti-Rust Treatment', category: 'Protection' },
  { id: 'windshield-treatment', label: 'Windshield Treatment', category: 'Protection' },

  // Detailing
  { id: 'interior-detailing', label: 'Interior Detailing', category: 'Detailing' },
  { id: 'exterior-detailing', label: 'Exterior Detailing', category: 'Detailing' },
  { id: 'engine-bay-detailing', label: 'Engine Bay Detailing', category: 'Detailing' },
  { id: 'paint-correction-1-step', label: 'Paint Correction — 1-Step', category: 'Detailing' },
  { id: 'paint-correction-2-step', label: 'Paint Correction — 2-Step', category: 'Detailing' },
  { id: 'paint-correction-3-step', label: 'Paint Correction — 3-Step', category: 'Detailing' },
  { id: 'headlight-restoration', label: 'Headlight Restoration', category: 'Detailing' },

  // Body Shop
  { id: 'full-body-painting', label: 'Full Body Painting', category: 'Body Shop' },
  { id: 'panel-painting', label: 'Panel Painting', category: 'Body Shop' },
  { id: 'dent-and-paint', label: 'Dent & Paint', category: 'Body Shop' },
  { id: 'scratch-repair', label: 'Scratch Repair', category: 'Body Shop' },
  { id: 'bumper-repair', label: 'Bumper Repair', category: 'Body Shop' },
  { id: 'alloy-wheel-refurbishment', label: 'Alloy Wheel Refurbishment', category: 'Body Shop' },

  // Wraps & Styling
  { id: 'vinyl-wrapping', label: 'Vinyl Wrapping', category: 'Wraps & Styling' },
  { id: 'roof-wrap', label: 'Roof Wrap', category: 'Wraps & Styling' },
  { id: 'chrome-delete', label: 'Chrome Delete', category: 'Wraps & Styling' },
  { id: 'window-tint', label: 'Window Tint', category: 'Wraps & Styling' },

  // Accessories
  { id: 'accessories-installation', label: 'Accessories Installation', category: 'Accessories' },
  { id: 'seat-covers', label: 'Seat Covers', category: 'Accessories' },
  { id: 'ambient-lighting', label: 'Ambient Lighting', category: 'Accessories' },
  { id: 'audio-system', label: 'Audio System', category: 'Accessories' },
  { id: 'dash-camera', label: 'Dash Camera', category: 'Accessories' },
  { id: 'reverse-camera', label: 'Reverse Camera', category: 'Accessories' },
  { id: 'spoiler', label: 'Spoiler', category: 'Accessories' },
  { id: 'bull-bar', label: 'Bull Bar', category: 'Accessories' },
  { id: 'other-custom-modifications', label: 'Other Custom Modifications', category: 'Accessories' },
];
