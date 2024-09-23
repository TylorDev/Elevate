import { useEffect, useState } from 'react'
import { Cola } from '../../Components/Cola/Cola'

import { useMini } from '../../Contexts/MiniContext'
import { usePlaylists } from '../../Contexts/PlaylistsContex'
import './Search.scss'

import Tab from '@mui/material/Tab'
import Tabs from '@mui/material/Tabs'
import Box from '@mui/material/Box'
import { createTheme, ThemeProvider } from '@mui/material/styles'

function Search() {
  const { recents, getRecents, most, getMost, results, searchSongs } = useMini()
  const { news, getNews } = usePlaylists()
  useEffect(() => {
    getRecents()
    getMost()
    getNews()
  }, [])

  const [value, setValue] = useState(0)
  // Crear el tema personalizado

  return (
    <>
      <Tabs
        id="tabControl"
        value={value}
        onChange={(_, newValue) => setValue(newValue)}
        aria-label="basic tabs"
      >
        <Tab id="tab" label="Recien escuchadas" />
        <Tab id="tab" label="Mas escuchadas" />
        <Tab id="tab" label="Nuevas canciones" />
      </Tabs>
      <CustomTabPanel value={value} index={0}>
        <Cola list={recents} />
      </CustomTabPanel>
      <CustomTabPanel value={value} index={1}>
        <Cola list={most} />
      </CustomTabPanel>
      <CustomTabPanel value={value} index={2}>
        <Cola list={news} />
      </CustomTabPanel>
    </>
  )
}
export default Search

function CustomTabPanel({ children, value, index }) {
  return value === index && <Box sx={{ p: 1 }}>{children}</Box>
}
