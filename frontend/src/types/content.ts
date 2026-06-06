import type { CampusOption } from './campus'

export type ContentType =
    | 'image'
    | 'video'
    | 'news'
    | 'advertisement'
    | 'pdf'

export type ContentStatus = 'active' | 'inactive'
export type ContentOperationalStatus =
    | 'activeWithoutAssignment'
    | 'activeWithUnavailableFile'
export type PdfDocumentExtractionStatus = 'processing' | 'processed' | 'failed'
export type PdfQuestionImageStatus = 'active' | 'inactive'

export interface Content {
    id: number
    title: string
    description: string | null
    contentType: ContentType
    fileUrl: string | null
    status: ContentStatus
    campusId: number
    campus: CampusOption | null
    createdAt: string
    updatedAt: string
    deletedAt?: string | null
}

export interface ContentFormValues {
    title: string
    description: string
    contentType: ContentType
    file: File | null
    status: ContentStatus
    campusId: string
}

export interface ContentFormErrors {
    title?: string
    description?: string
    contentType?: string
    file?: string
    status?: string
    campusId?: string
}

export interface ContentListParams {
    title?: string
    contentType?: ContentType | ''
    status?: ContentStatus | ''
    operationalStatus?: ContentOperationalStatus | ''
    campusId?: number | ''
    page?: number
    limit?: number
}

export interface PdfDocumentSummary {
    id: number
    contentId: number
    fileUrl: string
    extractionStatus: PdfDocumentExtractionStatus
    parsedPairsCount: number
    extractionError: string | null
    processedAt: string | null
    createdAt: string
    updatedAt: string
}

export interface PdfQuestionChunkSummary {
    id: number
    pdfDocumentId: number
    chunkOrder: number
    questionText: string
    answerText: string
    questionKey: string
    imageCount: number
    createdAt: string
    updatedAt: string
}

export interface PdfQuestionImage {
    id: number
    pdfChunkId: number
    fileUrl: string
    sortOrder: number
    status: PdfQuestionImageStatus
    createdAt: string
    updatedAt: string
    deletedAt?: string | null
}

export interface ContentPdfQuestionChunksData {
    content: Content
    pdfDocument: PdfDocumentSummary | null
    chunks: PdfQuestionChunkSummary[]
}

export interface ContentPdfChunkImagesData {
    chunk: Pick<
        PdfQuestionChunkSummary,
        'id' | 'chunkOrder' | 'questionText' | 'answerText' | 'questionKey'
    >
    images: PdfQuestionImage[]
}
