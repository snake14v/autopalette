// Single shared driver instance for the customer app. getDriver() is cached in the
// shared layer, but re-exporting it here keeps every route importing the same symbol
// and makes the demo/live mode a one-liner (`driver.mode`).
//
// getDriver() is async (it dynamically imports the firestore driver only when Firebase
// config is present — see src/shared/data.ts), so this module resolves it via top-level
// await. Every importer sees the already-resolved DataDriver, not a Promise: ES module
// evaluation waits for a module's top-level await to settle before its importers run.
import { getDriver } from '../../shared/data';

export const driver = await getDriver();
export const isDemo = driver.mode === 'demo';
