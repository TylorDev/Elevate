import { useNavigate } from 'react-router-dom'
import { useMini } from '../../Contexts/MiniContext'
import { Cola } from '../Cola/Cola'
import Modal from '../Modal/Modal'
import './SearchBar.scss'
import { useState } from 'react'
import icon from '../../../../../resources/icon.png'
import { FaSearch } from 'react-icons/fa'
function SearchBar() {
  const [isVisible, setIsVisible] = useState(false)
  const [query, setQuery] = useState('')
  const { results, searchSongs } = useMini()

  const openModal = async () => {
    await searchSongs(query)
    setIsVisible(true)
  }

  const closeModal = () => {
    setIsVisible(false)
  }

  const navigate = useNavigate()
  if (results.length > 0) console.log(results)

  return (
    <div className="search-bar" id="search-bar">
      <div className="s-t">
        <span>Elevate</span>
      </div>
      <div className="search-input">
        <input
          className="search-input-text"
          type="text"
          placeholder="Search music"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              openModal()
            }
          }}
        />
        <FaSearch />
      </div>

      <div
        className="settings"
        onClick={() => {
          navigate('/settings')
        }}
      >
        Settings
      </div>

      <Modal isVisible={isVisible} closeModal={closeModal}>
        {results.length > 0 ? <Cola list={results} /> : <h1 className="h1">NO RESULTS</h1>}
      </Modal>
    </div>
  )
}

export default SearchBar
