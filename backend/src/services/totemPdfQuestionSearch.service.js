import { pool } from '../config/db.js'

const DEFAULT_MIN_TRIGRAM_SCORE = 0.18
const DEFAULT_MIN_COMBINED_SCORE = 0.12
const DEFAULT_FTS_WEIGHT = 0.72
const DEFAULT_TRIGRAM_WEIGHT = 0.28

function parsePositiveFloat(rawValue, fallbackValue) {
  const parsedValue = Number(rawValue)

  if (!Number.isFinite(parsedValue) || parsedValue <= 0) {
    return fallbackValue
  }

  return parsedValue
}

function normalizeWeights(ftsWeight, trigramWeight) {
  const total = ftsWeight + trigramWeight

  if (total <= 0) {
    return {
      ftsWeight: DEFAULT_FTS_WEIGHT,
      trigramWeight: DEFAULT_TRIGRAM_WEIGHT,
    }
  }

  return {
    ftsWeight: ftsWeight / total,
    trigramWeight: trigramWeight / total,
  }
}

class TotemPdfQuestionSearchService {
  constructor() {
    this.minTrigramScore = parsePositiveFloat(
      process.env.TOTEM_QA_SEARCH_MIN_TRIGRAM_SCORE,
      DEFAULT_MIN_TRIGRAM_SCORE
    )

    this.minCombinedScore = parsePositiveFloat(
      process.env.TOTEM_QA_SEARCH_MIN_COMBINED_SCORE,
      DEFAULT_MIN_COMBINED_SCORE
    )

    const normalizedWeights = normalizeWeights(
      parsePositiveFloat(process.env.TOTEM_QA_SEARCH_FTS_WEIGHT, DEFAULT_FTS_WEIGHT),
      parsePositiveFloat(
        process.env.TOTEM_QA_SEARCH_TRIGRAM_WEIGHT,
        DEFAULT_TRIGRAM_WEIGHT
      )
    )

    this.ftsWeight = normalizedWeights.ftsWeight
    this.trigramWeight = normalizedWeights.trigramWeight
  }

  async summarizeTotemPdfCoverage(totemId) {
    const result = await pool.query(
      `
      SELECT
        COUNT(DISTINCT c.id)::int AS assigned_pdf_count,
        COUNT(DISTINCT CASE WHEN pd.id IS NOT NULL THEN c.id END)::int AS indexed_pdf_count,
        COUNT(DISTINCT CASE WHEN pd.extraction_status = 'processed' THEN c.id END)::int AS processed_pdf_count
      FROM totem_contents tc
      JOIN contents c
        ON c.id = tc.content_id
      LEFT JOIN pdf_documents pd
        ON pd.content_id = c.id
       AND pd.deleted_at IS NULL
      WHERE tc.totem_id = $1
        AND tc.status = 'active'
        AND tc.deleted_at IS NULL
        AND c.status = 'active'
        AND c.deleted_at IS NULL
        AND c.content_type = 'pdf'
        AND (tc.start_at IS NULL OR tc.start_at <= NOW())
        AND (tc.end_at IS NULL OR tc.end_at >= NOW());
      `,
      [totemId]
    )

    return result.rows[0] ?? {
      assigned_pdf_count: 0,
      indexed_pdf_count: 0,
      processed_pdf_count: 0,
    }
  }

  async findBestMatch(totemId, questionText) {
    const result = await pool.query(
      `
      WITH query_input AS (
        SELECT
          $2::text AS question_text,
          plainto_tsquery('spanish', $2::text) AS ts_query
      ),
      candidate_chunks AS (
        SELECT
          pc.id AS chunk_id,
          pc.question_text,
          pc.answer_text,
          pd.id AS pdf_document_id,
          pd.content_id,
          c.title AS content_title,
          CASE
            WHEN qi.ts_query = ''::tsquery THEN 0
            ELSE ts_rank_cd(
              to_tsvector(
                'spanish',
                COALESCE(pc.question_text, '')
              ),
              qi.ts_query
            )
          END AS fts_rank,
          similarity(pc.question_text, qi.question_text) AS trigram_score
        FROM query_input qi
        JOIN totem_contents tc
          ON tc.totem_id = $1
         AND tc.status = 'active'
         AND tc.deleted_at IS NULL
         AND (tc.start_at IS NULL OR tc.start_at <= NOW())
         AND (tc.end_at IS NULL OR tc.end_at >= NOW())
        JOIN contents c
          ON c.id = tc.content_id
         AND c.status = 'active'
         AND c.deleted_at IS NULL
         AND c.content_type = 'pdf'
        JOIN pdf_documents pd
          ON pd.content_id = c.id
         AND pd.deleted_at IS NULL
         AND pd.extraction_status = 'processed'
        JOIN pdf_chunks pc
          ON pc.pdf_document_id = pd.id
        WHERE (
            (qi.ts_query <> ''::tsquery AND to_tsvector(
              'spanish',
              COALESCE(pc.question_text, '')
            ) @@ qi.ts_query)
            OR similarity(pc.question_text, qi.question_text) >= $3
          )
      )
      SELECT
        chunk_id,
        question_text,
        answer_text,
        pdf_document_id,
        content_id,
        content_title,
        fts_rank,
        trigram_score,
        (fts_rank * $4 + trigram_score * $5) AS combined_score
      FROM candidate_chunks
      ORDER BY combined_score DESC, fts_rank DESC, trigram_score DESC, chunk_id ASC
      LIMIT 1;
      `,
      [
        totemId,
        questionText,
        this.minTrigramScore,
        this.ftsWeight,
        this.trigramWeight,
      ]
    )

    return result.rows[0] ?? null
  }

  async search(totemId, questionText) {
    const coverage = await this.summarizeTotemPdfCoverage(totemId)
    const assignedPdfCount = Number(coverage.assigned_pdf_count ?? 0)
    const indexedPdfCount = Number(coverage.indexed_pdf_count ?? 0)
    const processedPdfCount = Number(coverage.processed_pdf_count ?? 0)

    if (assignedPdfCount === 0) {
      return {
        coverage: {
          assignedPdfCount,
          indexedPdfCount,
          processedPdfCount,
        },
        match: null,
      }
    }

    if (processedPdfCount === 0) {
      return {
        coverage: {
          assignedPdfCount,
          indexedPdfCount,
          processedPdfCount,
        },
        match: null,
      }
    }

    const match = await this.findBestMatch(totemId, questionText)

    if (!match) {
      return {
        coverage: {
          assignedPdfCount,
          indexedPdfCount,
          processedPdfCount,
        },
        match: null,
      }
    }

    const combinedScore = Number(match.combined_score ?? 0)

    if (!Number.isFinite(combinedScore) || combinedScore < this.minCombinedScore) {
      return {
        coverage: {
          assignedPdfCount,
          indexedPdfCount,
          processedPdfCount,
        },
        match: null,
      }
    }

    return {
      coverage: {
        assignedPdfCount,
        indexedPdfCount,
        processedPdfCount,
      },
      match: {
        chunkId: Number(match.chunk_id),
        pdfDocumentId: Number(match.pdf_document_id),
        contentId: Number(match.content_id),
        contentTitle: match.content_title,
        matchedQuestionText: match.question_text,
        answerText: match.answer_text,
        ftsRank: Number(match.fts_rank ?? 0),
        trigramScore: Number(match.trigram_score ?? 0),
        combinedScore,
      },
    }
  }
}

export default new TotemPdfQuestionSearchService()
