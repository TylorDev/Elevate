/* eslint-disable react/prop-types */
import { usePlaylists } from '../../Contexts/PlaylistsContex'
import './PlaylistForm.scss'
import { useState } from 'react'

const PlaylistForm = ({ playlist, onUpdate, close }) => {
  const [formData, setFormData] = useState({
    path: playlist.path || '',
    nombre: playlist.nombre || '',
    duracion: playlist.duracion || 0,
    numElementos: playlist.numElementos || 0,
    totalplays: playlist.totalplays || 0
  })

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData((prevData) => ({
      ...prevData,
      [name]: value
    }))
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    close()
    const { path, ...data } = formData

    onUpdate(path, data)
  }

  return (
    <form onSubmit={handleSubmit} className="form">
      <label className="form__label">
        Path:
        <input
          type="text"
          name="path"
          value={formData.path}
          onChange={handleChange}
          disabled
          className="form__input"
        />
      </label>
      <br />
      <label className="form__label">
        Nombre:
        <input
          type="text"
          name="nombre"
          value={formData.nombre}
          onChange={handleChange}
          className="form__input"
        />
      </label>
      <br />
      <label className="form__label">
        Duración:
        <input
          type="number"
          name="duracion"
          value={formData.duracion}
          onChange={handleChange}
          className="form__input"
          disabled
        />
      </label>
      <br />
      <label className="form__label">
        Número de Elementos:
        <input
          type="number"
          name="numElementos"
          value={formData.numElementos}
          onChange={handleChange}
          className="form__input"
          disabled
        />
      </label>
      <br />
      <label className="form__label">
        Total Plays:
        <input
          type="number"
          name="totalplays"
          value={formData.totalplays}
          onChange={handleChange}
          className="form__input"
          disabled
        />
      </label>
      <br />
      <button type="submit" className="form__button">
        Actualizar Playlist
      </button>
    </form>
  )
}

export default PlaylistForm
