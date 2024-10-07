import { useEffect, useState } from 'react'
import { Cola } from '../../Components/Cola/Cola'

import { useMini } from '../../Contexts/MiniContext'
import { usePlaylists } from '../../Contexts/PlaylistsContex'
import './Search.scss'

import Tab from '@mui/material/Tab'
import Tabs from '@mui/material/Tabs'
import Box from '@mui/material/Box'

function Search() {
  const { recents, getRecents, most, getMost } = useMini()
  const { news, getNews } = usePlaylists()

  const [value, setValue] = useState(0)
  useEffect(() => {
    getRecents()
  }, [])
  const handleChange = (event, newValue) => {
    setValue(newValue)
    if (newValue === 0) {
      getRecents()
    }
    if (newValue === 1) {
      getMost()
    }
    if (newValue === 2) {
      getNews()
    }
  }

  return (
    <>
      <Tabs id="tabControl" value={value} onChange={handleChange} aria-label="basic tabs">
        <Tab id="tab" label="Recently Played" />
        <Tab id="tab" label="Most Played" />
        <Tab id="tab" label="New Releases" />
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
