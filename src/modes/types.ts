import type { ListKey, ListStatus, MediaType } from '../api/types';
import type { FetchProgress } from '../api/anilist';

export interface FetchSelection {
  mediaTypes: MediaType[];
  statuses: ListStatus[];
}

export type ProgressCallback = (progress: FetchProgress) => void;
export type BatchCallback<Node> = (nodes: Node[], list: ListKey) => void;

/**
 * Everything that differs between ranking characters and ranking anime:
 * the AniList node shape, the normalized entry stored in state, the filters,
 * and how raw nodes are fetched/merged/filtered. The tier-list UI and store
 * logic stay entity-agnostic and go through this interface.
 */
export interface EntryAdapter<Node, Entry, Filters> {
  /** Fetches every raw node on the selected lists of `username`. */
  fetchEntries(
    username: string,
    selection: FetchSelection,
    threshold: number,
    onProgress?: ProgressCallback,
    onBatch?: BatchCallback<Node>
  ): Promise<Node[]>;
  /** Merges one raw node into an existing entry (or creates it); preserves reference when unchanged. */
  mergeNode(existing: Entry | undefined, username: string, list: ListKey, node: Node): Entry;
  filterEntries(entries: Entry[], filters: Filters): Entry[];
  normalizeFilters(raw: Partial<Filters> | null | undefined): Filters;
  defaultFilters: Filters;
  /** Display name and image for a card. */
  getEntryName(entry: Entry): string;
  getEntryImage(entry: Entry): string;
  /** The numeric filter value usable as a fetch-time pruning threshold. */
  thresholdFromFilters(filters: Filters): number;
}
