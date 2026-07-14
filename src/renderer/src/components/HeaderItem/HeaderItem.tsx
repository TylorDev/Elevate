import { NavLink } from 'react-router-dom'
import './HeaderItem.scss'

const HeaderItem = ({ to, icon: Icon, label, onClick }) => {
  return (
    <NavLink 
      to={to} 
      className={({ isActive }) => (isActive ? 'header-item active' : 'header-item')}
      onClick={onClick}
    >
      {Icon && <Icon className="header-item-icon" />}
      <span className="header-item-label">{label}</span>
    </NavLink>
  )
}

export default HeaderItem
