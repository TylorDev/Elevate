/* eslint-disable react/prop-types */

import { AudioPlayer } from './AudioPlayer'

import { PlaylistActions } from './PlaylistActions'
import { Cola } from './Cola'
import { MainList } from './MainList'

const FilePathsComponent = () => {
  return (
    <div>
      <PlaylistActions />

      <div className="tracks">
        <div>
          <h2>tracks</h2>
          <MainList></MainList>
        </div>

        <div>
          <h2>Cola</h2>
          <Cola />
        </div>
      </div>
      <AudioPlayer />
    </div>
  )
}

export default FilePathsComponent
