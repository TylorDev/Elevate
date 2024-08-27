import { useEffect, useState } from 'react'
import { Cola } from '../../Components/Cola/Cola'

import { useMini } from '../../Contexts/MiniContext'

function Search() {
  const [query, setQuery] = useState('')
  const { recents, getRecents, most, getMost, results, searchSongs } = useMini()

  useEffect(() => {
    getRecents()
  }, [])

  const handleSearch = () => {
    searchSongs(query)
  }

  return (
    <div className="default-class">
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Ingresa tu búsqueda"
      />
      <button onClick={handleSearch}>Buscar</button>
      <h1>resultados!</h1>
      <Cola list={results} name="stats" />
      <button onClick={getMost}>Obtener mas reproducidos!</button>
      <h1>Mas reproducidos!</h1>
      <Cola list={most} name="stats" />
      <h1>recientes!</h1>
      <Cola list={recents} name="stats" />
    </div>
  )
}
export default Search
