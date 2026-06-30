import type { IpcMainInvokeEvent } from 'electron'
import type { MaybePromise } from './shared.ts'

export type IpcChannel<TContract> = Extract<keyof TContract, string>

export type IpcArgs<TContract, C extends keyof TContract> = TContract[C] extends {
  args: infer TArgs extends unknown[]
}
  ? TArgs
  : never

export type IpcInvokeHandler<TArgs extends unknown[], TResult> = (
  event: IpcMainInvokeEvent,
  ...args: TArgs
) => MaybePromise<TResult>
