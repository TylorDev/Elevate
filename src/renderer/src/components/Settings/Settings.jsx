import { HexColorPicker } from 'react-colorful'
import './Settings.scss'
import { useEffect, useState } from 'react'
import { Box, Tab } from '@mui/material'
import { Tabs } from '@mui/material'

function Settings() {
  const [color, setColor] = useState('orangered')
  useEffect(() => {
    document.documentElement.style.setProperty('--text-principal', color)
  }, [color])

  const handleChange = (value) => {
    setColor(value)
  }
  const [value, setValue] = useState(0)
  return (
    <div className="Settings">
      <Tabs
        id="tabControl"
        value={value}
        onChange={(_, newValue) => setValue(newValue)}
        aria-label="basic tabs"
      >
        <Tab id="tab" label="Colores" />
        <Tab id="tab" label="Rendimiento" />
        <Tab id="tab" label="Opciones avanzadas" />
      </Tabs>
      <CustomTabPanel value={value} index={0}>
        <HexColorPicker color={color} onChange={handleChange} />;
      </CustomTabPanel>
    </div>
  )
}
export default Settings

function CustomTabPanel({ children, value, index }) {
  return value === index && <Box sx={{ p: 1 }}>{children}</Box>
}
