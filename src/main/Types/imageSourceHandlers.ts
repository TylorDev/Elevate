import type { IpcArgs, IpcChannel, IpcInvokeHandler } from './ipc.ts'

export type ImageExtension = 'jpg' | 'jpeg' | 'png' | 'gif' | 'webp'

export type ImageMimeType = 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp'

export type ImageSourceType = 'local' | 'remote'

export type BackgroundItemStatus = 'ready' | 'missing' | 'invalid'

export type ImageContentTypeCategory = 'unknown' | 'html' | 'image' | 'unsupported'

export type ImageSourceErrorCode =
  | 'active_item'
  | 'canceled'
  | 'html_response'
  | 'http_error'
  | 'invalid_data_url'
  | 'invalid_url'
  | 'network_error'
  | 'not_found'
  | 'read_failed'
  | 'unsupported_content_type'

export type ImageSourceErrorResponse = {
  success: false
  errorCode: ImageSourceErrorCode
  errorMessage: string
}

export type DownloadedImageSuccess = {
  success: true
  buffer: Buffer
  mimeType: string
}

export type ImageLoadResult = DownloadedImageSuccess | ImageSourceErrorResponse

export type ImagePreviewSuccess = {
  success: true
  resolvedUrl: string
  mimeType: string
}

export type LocalImagePreviewSuccess = ImagePreviewSuccess & {
  filePath: string
}

export type ImagePreviewResult = ImagePreviewSuccess | ImageSourceErrorResponse

export type LocalImagePreviewResult = LocalImagePreviewSuccess | ImageSourceErrorResponse

export type BackgroundConfigItem = {
  id: string
  sourceType: ImageSourceType
  sourceValue: string
  resolvedAssetPath: string
  mimeType: string
  createdAt: string
  lastUsedAt: string
  status: BackgroundItemStatus
}

export type BackgroundConfig = {
  currentBackgroundId: string | null
  items: BackgroundConfigItem[]
}

export type CreateBackgroundItemRequest = {
  sourceType: ImageSourceType
  sourceValue: string
  resolvedAssetPath: string
  mimeType: string
  existingItem?: Pick<BackgroundConfigItem, 'id' | 'createdAt'> | null
}

export type UpsertBackgroundItemRequest = {
  sourceType: ImageSourceType
  sourceValue: string
  buffer: Buffer
  mimeType: string
}

export type MaterializedBackgroundItem = BackgroundConfigItem & {
  resolvedUrl: string
  displaySource: string
}

export type MaterializedBackgroundItemResult = {
  item: BackgroundConfigItem
  resolvedUrl: string
}

export type BackgroundState = {
  current: MaterializedBackgroundItem | null
  items: MaterializedBackgroundItem[]
}

export type BackgroundMutationSuccess = {
  success: true
} & BackgroundState

export type BackgroundMutationResult = BackgroundMutationSuccess | ImageSourceErrorResponse

export type RemoteImageRequest = {
  url?: string | null
}

export type BackgroundIdRequest = {
  id?: string | null
}

export type LegacyBackgroundRequest = {
  value?: string | null
}

export type ImageSourceIpcContract = {
  'image-source:validate-remote': {
    args: [request: RemoteImageRequest]
    result: ImagePreviewResult
  }
  'image-source:pick-local': {
    args: []
    result: LocalImagePreviewResult
  }
  'background-images:list': {
    args: []
    result: BackgroundState
  }
  'background-images:get-current': {
    args: []
    result: MaterializedBackgroundItem | null
  }
  'background-images:apply-remote': {
    args: [request: RemoteImageRequest]
    result: BackgroundMutationResult
  }
  'background-images:apply-local': {
    args: []
    result: BackgroundMutationResult
  }
  'background-images:select': {
    args: [request: BackgroundIdRequest]
    result: BackgroundMutationResult
  }
  'background-images:clear-current': {
    args: []
    result: BackgroundMutationResult
  }
  'background-images:remove': {
    args: [request: BackgroundIdRequest]
    result: BackgroundMutationResult
  }
  'background-images:migrate-legacy': {
    args: [request: LegacyBackgroundRequest]
    result: BackgroundMutationResult
  }
}

export type ImageSourceChannel = IpcChannel<ImageSourceIpcContract>
export type ImageSourceArgs<C extends ImageSourceChannel> = IpcArgs<ImageSourceIpcContract, C>
export type ImageSourceInvokeHandler<C extends ImageSourceChannel> = IpcInvokeHandler<
  ImageSourceArgs<C>,
  ImageSourceIpcContract[C]['result']
>
