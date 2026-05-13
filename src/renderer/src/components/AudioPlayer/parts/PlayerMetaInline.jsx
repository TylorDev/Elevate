import './PlayerMetaInline.scss'

import {
  MetadataArtist,
  MetadataCover,
  MetadataTitle,
  MetadataViews
} from '../Metadata'

export function PlayerMetaInline() {
  return (
    <>
      <MetadataCover className="AudioPlayerPartMetaInline__cover" />
      <MetadataTitle className="AudioPlayerPartMetaInline__title" />
      <div className="AudioPlayerPartMetaInline">
        <MetadataArtist className="AudioPlayerPartMetaInline__artist" />
        <MetadataViews className="AudioPlayerPartMetaInline__views" />
      </div>
    </>
  )
}
