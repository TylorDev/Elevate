import './PlayerMetaStack.scss'

import {
  MetadataArtist,
  MetadataCover,
  MetadataTitle,
  MetadataViews
} from '../Metadata'

export function PlayerMetaStack() {
  return (
    <>
      <MetadataCover className="AudioPlayerPartMetaStack__cover" />
      <div className="AudioPlayerPartMetaStack">
        <MetadataTitle className="AudioPlayerPartMetaStack__title" />
        <MetadataArtist className="AudioPlayerPartMetaStack__artist" />
        <MetadataViews className="AudioPlayerPartMetaStack__views" />
      </div>
    </>
  )
}
