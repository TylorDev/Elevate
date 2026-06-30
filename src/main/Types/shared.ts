export type MaybePromise<T> = T | Promise<T>

export type SuccessResponse<T extends object = object> = {
  success: true
  error?: never
  message?: string
} & T

export type ErrorResponse = {
  success: false
  error?: string
  message?: string
}

export type RequiredErrorResponse = ErrorResponse & {
  error: string
}

export type MutationResponse = SuccessResponse | ErrorResponse

export type PageRequest = {
  page?: number | string | null
  pageSize?: number | string | null
}

export type NormalizedPageRequest = {
  page: number
  pageSize: number
}

export type PageResult<T> = {
  items: T[]
  page: number
  pageSize: number
  total: number
  hasMore: boolean
}

export type SearchPageRequest = PageRequest & {
  query?: string | null
}

export type PageRequestInput = number | PageRequest | null | undefined

export type CoverVariant = 'thumb' | 'full'

export type MimeBufferPayload = {
  mimeType: string
  buffer: Buffer
}
