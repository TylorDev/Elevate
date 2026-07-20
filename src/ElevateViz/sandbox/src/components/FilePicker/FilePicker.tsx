import { LuFileAudio, LuUpload } from 'react-icons/lu'
import styles from './FilePicker.module.scss'

interface FilePickerProps {
  fileName?: string
  disabled?: boolean
  onSelect: (file: File | null) => void
}

export function FilePicker({ fileName, disabled = false, onSelect }: FilePickerProps) {
  return (
    <label className={`${styles.picker} ${disabled ? styles.disabled : ''}`}>
      <input
        className={styles.input}
        type="file"
        accept=".mp3,audio/mpeg"
        disabled={disabled}
        onChange={(event) => onSelect(event.currentTarget.files?.[0] ?? null)}
      />
      {fileName ? <LuFileAudio className={styles.icon} /> : <LuUpload className={styles.icon} />}
      <span className={styles.copy}>
        <strong>{fileName || 'Cargar un MP3 local'}</strong>
        <small>{fileName ? 'Seleccionar otro archivo' : 'El archivo nunca sale del navegador'}</small>
      </span>
    </label>
  )
}
