// Formatting helpers for the admin app — re-exported from the shared layer (promoted per
// docs/APP_SPEC.md) so the customer app can use the same ₹/date/amount-in-words helpers.
// Keep importing from here in admin code; nothing else needs to change.
export * from '../../shared/format';
