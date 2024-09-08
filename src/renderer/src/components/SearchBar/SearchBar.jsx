import './SearchBar.scss'
import { useState } from 'react'

function SearchBar() {
  return (
    <div className="search-bar">
      <div className="s-t">Developer</div>
      <input className="search-input" type="text" placeholder="Search music" />
      <div className="settings">settings</div>
    </div>
  )
}

export default SearchBar
