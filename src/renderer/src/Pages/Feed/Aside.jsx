import { Cola } from '../../Components/Cola/Cola'
import './Aside.scss'
import { useMini } from '../../Contexts/MiniContext'
import { usePlaylists } from '../../Contexts/PlaylistsContex'

import { Section } from './Section'
import { useEffect } from 'react'
export function Aside(gridArea) {
  const { recents, getRecents } = useMini()
  const { news, getNews } = usePlaylists()

  useEffect(() => {
    if (recents) getRecents()
  }, [])
  useEffect(() => {
    if (news) getNews()
  }, [])
  return (
    <aside className="aside" style={gridArea ? { gridArea } : {}}>
      <Section name={'NUEVAS'} to={'/search'}>
        <Cola list={news.slice(0, 5)} />
      </Section>
      <Section name={'Recientes'} to={'/search'}>
        <Cola list={recents.slice(0, 5)} />
      </Section>
    </aside>
  )
}
