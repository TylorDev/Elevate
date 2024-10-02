import { useNavigate } from 'react-router-dom'
import { useMini } from '../../Contexts/MiniContext'
import { Cola } from '../Cola/Cola'
import Modal from '../Modal/Modal'
import './SearchBar.scss'
import { useState } from 'react'

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

  return (
    <div className="search-bar">
      <div className="s-t">Developer</div>
      <input
        className="search-input"
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

      <div
        className="settings"
        onClick={() => {
          navigate('/settings')
        }}
      >
        settings
      </div>
      <Modal isVisible={isVisible} closeModal={closeModal}>
        <Cola list={results} />
      </Modal>
    </div>
  )
}

export default SearchBar
