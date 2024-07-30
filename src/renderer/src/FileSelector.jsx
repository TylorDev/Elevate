/* eslint-disable react/prop-types */

import { AudioPlayer } from './AudioPlayer'

import { PlaylistActions } from './PlaylistActions'
import { Cola } from './Cola'

import { useAppContext } from './Contexts/AppContext'

const FilePathsComponent = () => {
  const { emptyList } = useAppContext()
  const { metadata } = useAppContext()
  return (
    <div>
      <PlaylistActions />

      <div className="tracks">
        <div>
          <h2>tracks</h2>

          <Cola list={metadata} name={'tracks'} />
        </div>

        <div>
          <h2>Cola</h2>
          <Cola list={emptyList} name={'cola'} />
        </div>
      </div>
      {/* <AudioPlayer /> */}
    </div>
  )
}

export default FilePathsComponent
