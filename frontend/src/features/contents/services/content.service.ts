import { apiRequest } from "../../../services/api";
import { pickFieldErrors } from "../../../utils/apiFieldErrors";
import type {
    ApiItemResponse,
    ApiListResponse,
    ApiMessageResponse,
} from "../../../types/totem";
import type {
    ContentPdfChunkImagesData,
    ContentPdfQuestionChunksData,
    Content,
    ContentFormErrors,
    ContentFormValues,
    ContentListParams,
    PdfQuestionImage,
    PdfQuestionImageStatus,
    ContentStatus,
} from "../../../types/content";

const CONTENT_FORM_ERROR_KEYS = [
    'title',
    'description',
    'contentType',
    'file',
    'status',
    'campusId',
    'campus_id',
    'chunkId',
    'chunk_id',
    'imageId',
    'image_id',
    'sortOrder',
    'sort_order',
] as const

function buildQueryParams(params: ContentListParams) {
    const searchParams = new URLSearchParams()

    if (params.title) searchParams.set('title', params.title)
    if (params.contentType) searchParams.set('contentType', params.contentType)
    if (params.status) searchParams.set('status', params.status)
    if (params.operationalStatus) searchParams.set('operationalStatus', params.operationalStatus)
    if (params.campusId) searchParams.set('campusId', String(params.campusId))
    if (params.page) searchParams.set('page', String(params.page))
    if (params.limit) searchParams.set('limit', String(params.limit))

    return searchParams.toString()
}

function buildFormData(payload: ContentFormValues) {
    const formData = new FormData()

    formData.append('title', payload.title)
    formData.append('description', payload.description)
    formData.append('contentType', payload.contentType)
    formData.append('status', payload.status)
    formData.append('campusId', payload.campusId)

    if (payload.file) {
        formData.append('file', payload.file)
    }

    return formData
}

export const contentService = {
    async getContents(
        params: ContentListParams,
        options: { signal?: AbortSignal } = {},
    ) {
        const query = buildQueryParams(params)
        const endpoint = query ? `/api/contents?${query}` : `/api/contents`

        return apiRequest<ApiListResponse<Content>>(endpoint, {
            signal: options.signal,
        })
    },

    async getContentById(id: number) {
        return apiRequest<ApiItemResponse<Content>>(`/api/contents/${id}`)
    },

    async createContent(payload: ContentFormValues) {
        return apiRequest<ApiItemResponse<Content>>('/api/contents', {
            method: 'POST',
            body: buildFormData(payload),
        })
    },

    async updateContent(id: number, payload: ContentFormValues) {
        return apiRequest<ApiItemResponse<Content>>(`/api/contents/${id}`, {
            method: 'PATCH',
            body: buildFormData(payload),
        })
    },

    async changeContentStatus(id: number, status: ContentStatus) {
        return apiRequest<ApiItemResponse<Content>>(`/api/contents/${id}`, {
            method: 'PATCH',
            body: JSON.stringify({ status }),
        })
    },

    async deleteContent(id: number) {
        return apiRequest<ApiMessageResponse>(`/api/contents/${id}`, {
            method: 'DELETE',
        })
    },

    async getPdfQuestionChunks(contentId: number) {
        return apiRequest<ApiItemResponse<ContentPdfQuestionChunksData>>(
            `/api/contents/${contentId}/pdf-question-chunks`
        )
    },

    async getPdfChunkImages(contentId: number, chunkId: number) {
        return apiRequest<ApiItemResponse<ContentPdfChunkImagesData>>(
            `/api/contents/${contentId}/pdf-question-chunks/${chunkId}/images`
        )
    },

    async uploadPdfChunkImages(contentId: number, chunkId: number, files: File[]) {
        const formData = new FormData()

        for (const file of files) {
            formData.append('files', file)
        }

        return apiRequest<ApiItemResponse<PdfQuestionImage[]>>(
            `/api/contents/${contentId}/pdf-question-chunks/${chunkId}/images`,
            {
                method: 'POST',
                body: formData,
            }
        )
    },

    async updatePdfQuestionImageMetadata(
        contentId: number,
        imageId: number,
        payload: {
            sortOrder?: number
            status?: PdfQuestionImageStatus
        }
    ) {
        return apiRequest<ApiItemResponse<PdfQuestionImage>>(
            `/api/contents/${contentId}/pdf-question-images/${imageId}`,
            {
                method: 'PATCH',
                body: JSON.stringify(payload),
            }
        )
    },

    async replacePdfQuestionImageFile(contentId: number, imageId: number, file: File) {
        const formData = new FormData()
        formData.append('file', file)

        return apiRequest<ApiItemResponse<PdfQuestionImage>>(
            `/api/contents/${contentId}/pdf-question-images/${imageId}/file`,
            {
                method: 'PUT',
                body: formData,
            }
        )
    },

    async deletePdfQuestionImage(contentId: number, imageId: number) {
        return apiRequest<ApiMessageResponse>(
            `/api/contents/${contentId}/pdf-question-images/${imageId}`,
            {
                method: 'DELETE',
            }
        )
    },
}

export function getContentFieldErrors(error: unknown): ContentFormErrors {
    return pickFieldErrors(error, CONTENT_FORM_ERROR_KEYS)
}
