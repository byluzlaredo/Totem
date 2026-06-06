import {
  ChevronLeft,
  ChevronRight,
  Rows3,
} from "lucide-react";

const DEFAULT_PAGE_SIZE_OPTIONS = [5, 10, 20, 30];
const PAGE_SIBLING_COUNT = 2;

type PageToken = number | "left-ellipsis" | "right-ellipsis";

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  pageSize: number;
  pageSizeOptions?: number[];
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
}

function createRange(start: number, end: number) {
  if (end < start) {
    return [];
  }

  return Array.from({ length: end - start + 1 }, (_, index) => start + index);
}

function buildPageTokens(
  totalPages: number,
  currentPage: number,
  siblingCount = PAGE_SIBLING_COUNT,
): PageToken[] {
  if (totalPages <= 0) {
    return [];
  }

  const totalVisibleNumbers = siblingCount * 2 + 5;
  if (totalPages <= totalVisibleNumbers) {
    return createRange(1, totalPages);
  }

  const leftSibling = Math.max(currentPage - siblingCount, 1);
  const rightSibling = Math.min(currentPage + siblingCount, totalPages);
  const showLeftEllipsis = leftSibling > 2;
  const showRightEllipsis = rightSibling < totalPages - 1;

  if (!showLeftEllipsis && showRightEllipsis) {
    const leftItemCount = siblingCount * 2 + 3;
    return [...createRange(1, leftItemCount), "right-ellipsis", totalPages];
  }

  if (showLeftEllipsis && !showRightEllipsis) {
    const rightItemCount = siblingCount * 2 + 3;
    return [
      1,
      "left-ellipsis",
      ...createRange(totalPages - rightItemCount + 1, totalPages),
    ];
  }

  return [
    1,
    "left-ellipsis",
    ...createRange(leftSibling, rightSibling),
    "right-ellipsis",
    totalPages,
  ];
}

export default function Pagination({
  currentPage,
  totalPages,
  totalItems,
  pageSize,
  pageSizeOptions,
  onPageChange,
  onPageSizeChange,
}: PaginationProps) {
  const sanitizedTotalPages =
    Number.isFinite(totalPages) && totalPages > 0
      ? Math.floor(totalPages)
      : 0;
  const normalizedCurrentPage = Number.isFinite(currentPage)
    ? Math.floor(currentPage)
    : 1;
  const sanitizedCurrentPage =
    sanitizedTotalPages === 0
      ? 1
      : Math.min(Math.max(normalizedCurrentPage, 1), sanitizedTotalPages);
  const canGoBack = sanitizedCurrentPage > 1;
  const canGoForward = sanitizedCurrentPage < sanitizedTotalPages;
  const pageTokens = buildPageTokens(sanitizedTotalPages, sanitizedCurrentPage);

  const normalizedPageSizeOptions = (() => {
    const baseOptions =
      pageSizeOptions && pageSizeOptions.length > 0
        ? pageSizeOptions
        : DEFAULT_PAGE_SIZE_OPTIONS;
    const uniquePositiveOptions = [...new Set(baseOptions)].filter(
      (option) => Number.isInteger(option) && option > 0,
    );

    if (pageSize > 0 && !uniquePositiveOptions.includes(pageSize)) {
      uniquePositiveOptions.push(pageSize);
    }

    return uniquePositiveOptions;
  })();

  function scrollToTop() {
    window.scrollTo({
      top: 0,
      left: 0,
      behavior: "smooth",
    });
  }

  function handlePageNavigation(nextPage: number) {
    if (
      nextPage < 1
      || nextPage > sanitizedTotalPages
      || nextPage === sanitizedCurrentPage
    ) {
      return;
    }

    onPageChange(nextPage);

    requestAnimationFrame(() => {
      scrollToTop();
    });
  }

  function handlePageSizeSelection(nextPageSize: number) {
    onPageSizeChange(nextPageSize);

    requestAnimationFrame(() => {
      scrollToTop();
    });
  }

  return (
    <nav
      aria-label="Paginacion"
      className="rounded-2xl border border-(--color-border) bg-[#fbfbfb] px-3 py-2 sm:px-4"
    >
      <div className="flex flex-wrap items-center gap-2.5">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-(--color-text-secondary)">
          <p>
            Total de registros:{" "}
            <span className="font-semibold text-(--color-text-main)">
              {totalItems}
            </span>
          </p>
          <p>
            Pagina{" "}
            <span className="font-semibold text-(--color-text-main)">
              {sanitizedTotalPages === 0 ? 0 : sanitizedCurrentPage}
            </span>{" "}
            de{" "}
            <span className="font-semibold text-(--color-text-main)">
              {sanitizedTotalPages}
            </span>
          </p>
        </div>

        <label className="inline-flex items-center gap-2 whitespace-nowrap text-xs text-(--color-text-secondary)">
          <Rows3 className="h-4 w-4" />
          Registros por pagina
          <select
            value={pageSize}
            onChange={(e) => handlePageSizeSelection(Number(e.target.value))}
            className="rounded-lg border border-(--color-border) bg-white px-2 py-1 text-xs text-(--color-text-main) outline-none transition focus:border-(--color-red-main) focus:ring-2 focus:ring-(--color-red-main)/20"
          >
            {normalizedPageSizeOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>

        <div className="flex w-full flex-wrap items-center gap-1 sm:ml-auto sm:w-auto sm:justify-end">
          <div className="flex flex-wrap items-center gap-1 sm:flex-nowrap">
            <button
              type="button"
              onClick={() => handlePageNavigation(sanitizedCurrentPage - 1)}
              disabled={!canGoBack}
              className="inline-flex items-center gap-1 whitespace-nowrap rounded-lg border border-(--color-border) bg-white px-2 py-1 text-xs font-medium text-(--color-text-main) transition hover:bg-[#f6f6f6] disabled:cursor-not-allowed disabled:opacity-50"
            >
              <ChevronLeft className="h-4 w-4" />
              Anterior
            </button>

            {pageTokens.map((token) => {
              if (typeof token !== "number") {
                return (
                  <span
                    key={token}
                    className="inline-flex min-w-6 items-center justify-center px-1 py-1 text-xs font-semibold text-(--color-text-secondary)"
                    aria-hidden="true"
                  >
                    ...
                  </span>
                );
              }

              const isCurrentPage = token === sanitizedCurrentPage;
              return (
                <button
                  key={token}
                  type="button"
                  onClick={() => handlePageNavigation(token)}
                  disabled={isCurrentPage}
                  aria-current={isCurrentPage ? "page" : undefined}
                  className={`inline-flex min-w-7 items-center justify-center rounded-lg border px-2 py-1 text-xs font-semibold transition ${isCurrentPage
                      ? "cursor-default border-(--color-red-main) bg-(--color-red-main) text-white"
                      : "border-(--color-border) bg-white text-(--color-text-main) hover:bg-[#f6f6f6]"
                    }`}
                >
                  {token}
                </button>
              );
            })}

            <button
              type="button"
              onClick={() => handlePageNavigation(sanitizedCurrentPage + 1)}
              disabled={!canGoForward}
              className="inline-flex items-center gap-1 whitespace-nowrap rounded-lg border border-(--color-border) bg-white px-2 py-1 text-xs font-medium text-(--color-text-main) transition hover:bg-[#f6f6f6] disabled:cursor-not-allowed disabled:opacity-50"
            >
              Siguiente
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
}
