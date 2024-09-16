import { useEffect, useState } from 'react'
import { Cola } from '../../Components/Cola/Cola'

import { useMini } from '../../Contexts/MiniContext'
import { usePlaylists } from '../../Contexts/PlaylistsContex'

function Search() {
  const [query, setQuery] = useState('')
  const { recents, getRecents, most, getMost, results, searchSongs } = useMini()
  const { news, getNews } = usePlaylists()
  useEffect(() => {
    getRecents()
  }, [])

  const handleSearch = () => {
    searchSongs(query)
    console.log(news)
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
      <button onClick={getNews}>OBTENER NUEVAS!</button>
      <h1>NUEVAS!</h1>
      <Cola list={news} name="stats" />
    </div>
  )
}
export default Search
