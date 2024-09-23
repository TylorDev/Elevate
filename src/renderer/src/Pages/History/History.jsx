import './History.scss'

import { useMini } from '../../Contexts/MiniContext'
import { useEffect, useState } from 'react'
import { Cola } from '../../Components/Cola/Cola'

import { Pagination } from '@mui/material'

function History() {
  const { getHistory, history } = useMini()

  useEffect(() => {
    getHistory(1)
  }, [])

  const [page, setPage] = useState(1)
  const handleChange = (event, value) => {
    setPage(value)
    getHistory(value)
    console.log('cargando la pagina ', value)
  }

  return (
    <div className="default-class" style={{ color: 'white' }}>
      <Cola list={history.fileInfos} />
      <Pagination
        count={history.maxPages}
        variant="outlined" // Cambia a 'outlined' para tener un borde
        shape="rounded"
        color="primary"
        page={page}
        onChange={handleChange}
        sx={{
          '& .MuiPaginationItem-root': {
            color: 'white', // Color del texto
            borderColor: 'white' // Color del borde
          }
        }}
      />
    </div>
  )
}
export default History
