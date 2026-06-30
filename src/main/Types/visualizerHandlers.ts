import type { IpcMainInvokeEvent } from 'electron'
import type {
  Prisma,
  PrismaClient,
  VisualizerPlaybackSourceType as DatabaseVisualizerSourceType,
  VisualizerPresetList,
  VisualizerPresetListItem,
  VisualizerPresetSourceMode as DatabaseVisualizerPresetSourceMode,
  VisualizerSettings
} from '../generated/prisma/client.ts'
import type { MaybePromise } from './filehandlers.ts'

export type VisualizerPresetSourceMode = 'all' | 'favorites' | 'list'

export type VisualizerSourceType = 'favorites' | 'playlist' | 'directory'

export type VisualizerPresetSource = {
  mode: VisualizerPresetSourceMode
  listId: string | null
}

export type VisualizerSource = {
  type: VisualizerSourceType
  id: string
}

export type VisualizerPresetListState = {
  id: string
  name: string
  presetNames: string[]
  createdAt: number
  updatedAt: number
}

export type VisualizerState = {
  cycleDurationMs: number
  presetSource: VisualizerPresetSource
  favorites: string[]
  presetLists: VisualizerPresetListState[]
  sourceAssociations: Record<string, string>
}

export type VisualizerUpdateSettingsPayload = {
  cycleDurationMs?: number
  presetSource?: {
    mode?: VisualizerPresetSourceMode | null
    listId?: string | null
  }
}

export type VisualizerRenameListPayload = {
  listId?: string | null
  name?: string | null
}

export type VisualizerTogglePresetPayload = {
  listId?: string | null
  presetName?: string | null
}

export type VisualizerAssociateSourcePayload = {
  source?: Partial<VisualizerSource> | null
  listId?: string | null
}

export type VisualizerErrorResponse = {
  success: false
  error: string
}

export type VisualizerStateSuccessResponse = {
  success: true
  state: VisualizerState
}

export type VisualizerStateResult = VisualizerStateSuccessResponse | VisualizerErrorResponse

export type VisualizerCreateListSuccessResponse = VisualizerStateSuccessResponse & {
  list: VisualizerPresetListState
}

export type VisualizerCreateListResult =
  | VisualizerCreateListSuccessResponse
  | VisualizerErrorResponse

export type VisualizerPresetListWithItems = Prisma.VisualizerPresetListGetPayload<{
  include: { items: true }
}>

export type VisualizerDataClient = Pick<
  PrismaClient,
  | 'visualizerSettings'
  | 'visualizerPresetFavorite'
  | 'visualizerPresetList'
  | 'visualizerPresetListItem'
  | 'visualizerSourceAssociation'
>

export type VisualizerPrismaClient = PrismaClient

export type VisualizerTransactionClient = Prisma.TransactionClient

export type VisualizerSettingsMutationData = Partial<
  Pick<VisualizerSettings, 'cycleDurationMs' | 'presetSourceMode' | 'presetSourceListId'>
>

export type VisualizerListRecord = VisualizerPresetList & {
  items?: VisualizerPresetListItem[]
}

export type VisualizerPresetSourceModeMap = Record<
  VisualizerPresetSourceMode,
  DatabaseVisualizerPresetSourceMode
>

export type VisualizerPresetSourceModeReverseMap = Record<
  DatabaseVisualizerPresetSourceMode,
  VisualizerPresetSourceMode
>

export type VisualizerSourceTypeMap = Record<VisualizerSourceType, DatabaseVisualizerSourceType>

export type VisualizerSourceTypeReverseMap = Record<
  DatabaseVisualizerSourceType,
  VisualizerSourceType
>

export type VisualizerIpcContract = {
  'visualizer:load-state': {
    args: []
    result: VisualizerStateResult
  }
  'visualizer:update-settings': {
    args: [payload?: VisualizerUpdateSettingsPayload]
    result: VisualizerStateResult
  }
  'visualizer:toggle-favorite': {
    args: [presetName?: string | null]
    result: VisualizerStateResult
  }
  'visualizer:create-list': {
    args: [name?: string | null]
    result: VisualizerCreateListResult
  }
  'visualizer:rename-list': {
    args: [payload?: VisualizerRenameListPayload]
    result: VisualizerStateResult
  }
  'visualizer:delete-list': {
    args: [listId?: string | null]
    result: VisualizerStateResult
  }
  'visualizer:toggle-preset-in-list': {
    args: [payload?: VisualizerTogglePresetPayload]
    result: VisualizerStateResult
  }
  'visualizer:associate-source': {
    args: [payload?: VisualizerAssociateSourcePayload]
    result: VisualizerStateResult
  }
  'visualizer:remove-source-association': {
    args: [source?: Partial<VisualizerSource> | null]
    result: VisualizerStateResult
  }
  'visualizer:prune-source-associations': {
    args: [sourceKeys?: string[]]
    result: VisualizerStateResult
  }
}

export type VisualizerChannel = keyof VisualizerIpcContract

export type VisualizerArgs<C extends VisualizerChannel> = VisualizerIpcContract[C]['args']

export type VisualizerResult<C extends VisualizerChannel> = VisualizerIpcContract[C]['result']

export type VisualizerInvokeHandler<C extends VisualizerChannel> = (
  event: IpcMainInvokeEvent,
  ...args: VisualizerArgs<C>
) => MaybePromise<VisualizerResult<C>>
