import './PlayerTimeInline.scss'

import { CurrentTimeDisplay, DurationDisplay } from '../../Timer/Timer'

export function PlayerTimeInline({ className = '', mode = 'inline' }) {
  const rootClassName = [
    'AudioPlayerPartTime',
    mode === 'split' ? 'AudioPlayerPartTime--split' : 'AudioPlayerPartTime--inline',
    className
  ].filter(Boolean).join(' ')

  return (
    <div className={rootClassName} aria-label="Song time">
      <CurrentTimeDisplay className="AudioPlayerPartTime__current" />
      {mode === 'inline' && <span className="AudioPlayerPartTime__separator">/</span>}
      <DurationDisplay className="AudioPlayerPartTime__duration" />
    </div>
  )
}
