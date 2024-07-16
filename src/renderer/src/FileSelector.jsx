/* eslint-disable react/prop-types */

import { AudioPlayer } from './AudioPlayer'

import { PlaylistActions } from './PlaylistActions'
import { Cola } from './Cola'

const FilePathsComponent = () => {
  return (
    <div>
      <PlaylistActions />

      <div className="tracks">
        <div>
          <h2>tracks</h2>
          <Cola name={'tracks'} />
        </div>

        <div>
          <h2>Cola</h2>
          <Cola name={'cola'} />
        </div>
      </div>
      <AudioPlayer />
    </div>
  )
}

export default FilePathsComponent
