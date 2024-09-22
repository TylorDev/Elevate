import { useEffect, useState } from 'react'
import { Cola } from '../../Components/Cola/Cola'

import { useMini } from '../../Contexts/MiniContext'
import { usePlaylists } from '../../Contexts/PlaylistsContex'

import Tab from '@mui/material/Tab'
import Tabs from '@mui/material/Tabs'
import Box from '@mui/material/Box'
import { createTheme, ThemeProvider } from '@mui/material/styles'
import { PieChart } from '@mui/x-charts/PieChart'
import { Typography, Stack } from '@mui/material'
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
  const theme = createTheme({
    palette: {
      primary: {
        main: '#c33' // Azul
      },
      secondary: {
        main: '#c33' // Rojo
      }
    }
  })

  return (
    <ThemeProvider theme={theme}>
      <Tabs
        textColor="primary"
        indicatorColor="secondary" // La línea indicadora será roja
        value={value}
        onChange={(_, newValue) => setValue(newValue)}
        aria-label="basic tabs"
      >
        <Tab label="Recien escuchadas" sx={{ color: 'white' }} />
        <Tab label="Mas escuchadas" sx={{ color: 'white' }} />
        <Tab label="Nuevas canciones" sx={{ color: 'white' }} />
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
    </ThemeProvider>
  )
}
export default Search

function CustomTabPanel({ children, value, index }) {
  return value === index && <Box sx={{ p: 1 }}>{children}</Box>
}
