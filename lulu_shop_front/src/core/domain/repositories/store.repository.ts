import type { StoreContent } from "../models/store";

export interface StoreRepository {
  getHomepageContent(): Promise<StoreContent>;
}
