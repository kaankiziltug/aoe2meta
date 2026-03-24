import { AoE2DataProvider } from "./types";
import { MicrosoftApiProvider } from "./microsoft-provider";
import { MockDataProvider } from "./mock-data";

/**
 * Returns the active data provider.
 * Set NEXT_PUBLIC_USE_MOCK_DATA=true in .env.local to force mock data.
 */
export function createDataProvider(): AoE2DataProvider {
  if (process.env.NEXT_PUBLIC_USE_MOCK_DATA === "true") {
    return new MockDataProvider();
  }
  return new MicrosoftApiProvider();
}
