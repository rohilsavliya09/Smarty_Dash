import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom'; // Import routing components
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faHome, faTasks, faCalendar, faCog, faStar, faSignOutAlt } from '@fortawesome/free-solid-svg-icons';
import './Header.css'

function Header({ onLogout }) {
  const [dateTime, setDateTime] = useState(new Date());
  const location = useLocation(); // Get current location
  const username = localStorage.getItem("Ruser") || "Guest";

  
  
  useEffect(() => {
    const timer = setInterval(() => {
      setDateTime(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const options = {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  };

  // Check if a link is active
  const isActive = (path) => {
    return location.pathname === path;
  };

  return (
    <header className="headerContainer">
      <div className="logoSection">
        <FontAwesomeIcon icon={faStar} className="logoIcon" />
        <span className="logoText">Smarty-Dash</span>
      </div>

      <div className="dateTimeSection">
        <span className="timeDisplay">{dateTime.toLocaleTimeString()}</span>
        <span className="dateDisplay">{dateTime.toLocaleDateString("en-US", options)}</span>
        <div className="userGreeting"><h3>Hello {username}</h3></div>
      </div>

      <nav className="navigationMenu">
        <ul className="navList">

          <li className="navItem">
            <Link 
              to="/dashboard" 
              className={`navLink ${isActive('/dashboard') ? 'activeLink' : ''}`}
            >
              <FontAwesomeIcon icon={faHome} className="navIcon" /> Dashboard
            </Link>
          </li>

          <li className="navItem">
             <Link 
              to="/Project" 
              className={`navLink ${isActive('/Project') ? 'activeLink' : ''}`}
              >
                <FontAwesomeIcon icon={faTasks} className="navIcon" /> Projects
            </Link>
          </li>

          <li className="navItem">
            <Link 
              to="/calendar" 
              className={`navLink ${isActive('/calendar') ? 'activeLink' : ''}`}
            >
              <FontAwesomeIcon icon={faCalendar} className="navIcon" /> Calendar
            </Link>
          </li>

          <li className="navItem">
            <Link 
              to="/setting" 
              className={`navLink ${isActive('/setting') ? 'activeLink' : ''}`}
            >
              <FontAwesomeIcon icon={faCog} className="navIcon" /> Settings
            </Link>
          </li>
         
        </ul>
      </nav>
    </header>
  );
}

export default Header;