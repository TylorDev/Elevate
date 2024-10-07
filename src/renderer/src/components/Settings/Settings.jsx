import { HexColorPicker } from 'react-colorful'
import './Settings.scss'
import { useEffect, useState } from 'react'
import { Box, Tab } from '@mui/material'
import { Tabs } from '@mui/material'
import { useSuper } from '../../Contexts/SupeContext'
import { Button } from '../Button/Button'

function Settings() {
  const { color, handleColorChange } = useSuper()

  const [value, setValue] = useState(0)
  const [imageUrl, setImageUrl] = useState('')
  const handleUrlChange = (event) => {
    const newUrl = event.target.value
    setImageUrl(newUrl) // Actualizar el estado con la nueva URL
    localStorage.setItem('bannerImageUrl', newUrl) // Guardar la nueva URL en localStorage
  }

  useEffect(() => {
    const savedImageUrl = localStorage.getItem('bannerImageUrl')
    if (savedImageUrl) {
      setImageUrl(savedImageUrl) // Si existe, lo cargamos en el estado
    } else {
      setImageUrl('https://i.pinimg.com/originals/65/ff/25/65ff25ffbe3786b2de094f7051bbd873.gif')
    }
  }, [])
  const hexColorRegex = /^#([0-9A-Fa-f]{3}){1,2}$/

  return (
    <div className="Settings">
      <Tabs
        id="tabControl"
        value={value}
        onChange={(_, newValue) => setValue(newValue)}
        aria-label="basic tabs"
      >
        <Tab id="tab" label="Colors" />
      </Tabs>
      <CustomTabPanel value={value} index={0}>
        <h3>Current color: {color}</h3>
        <HexColorPicker color={color} onChange={handleColorChange} />

        <input
          id="Input"
          type="text"
          value={imageUrl}
          onChange={handleUrlChange}
          placeholder="Enter the image url"
        />
        <Button onClick={() => handleUrlChange({ target: { value: '' } })}>Clear</Button>

        <img src={imageUrl} alt="banner" width={200} />
      </CustomTabPanel>
    </div>
  )
}
export default Settings

function CustomTabPanel({ children, value, index }) {
  return (
    value === index && (
      <div className="tabPage" sx={{ p: 1 }}>
        {children}
      </div>
    )
  )
}
