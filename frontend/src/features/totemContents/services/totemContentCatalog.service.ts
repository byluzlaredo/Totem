import type { Content } from "../../../types/content";
import { contentService } from "../../contents/services/content.service";
import { totemService } from "../../totems/services/totem.service";

export const ASSIGNMENT_CATALOG_PAGE_SIZE = 50;

interface AssignmentTotemCatalogPageParams {
  page: number;
  limit?: number;
  search?: string;
  signal?: AbortSignal;
}

interface AssignmentContentCatalogPageParams {
  page: number;
  limit?: number;
  search?: string;
  contentType?: Content["contentType"] | "";
  signal?: AbortSignal;
}

export async function fetchActiveTotemsCatalogPage({
  page,
  limit = ASSIGNMENT_CATALOG_PAGE_SIZE,
  search,
  signal,
}: AssignmentTotemCatalogPageParams) {
  return totemService.getTotems({
    state: "active",
    search: search?.trim() || undefined,
    page,
    limit,
  }, {
    signal,
  });
}

export async function fetchActiveContentsCatalogPage({
  page,
  limit = ASSIGNMENT_CATALOG_PAGE_SIZE,
  search,
  contentType,
  signal,
}: AssignmentContentCatalogPageParams) {
  return contentService.getContents({
    status: "active",
    title: search?.trim() || undefined,
    contentType: contentType || undefined,
    page,
    limit,
  }, {
    signal,
  });
}
