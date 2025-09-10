import React, { useState, useEffect } from "react";
import "./Setting.css";
import { faSignOutAlt } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';

function Setting({ onLogout, currentTheme, setTheme }) {
  const [displayedContent, setDisplayedContent] = useState("");
  const [displayedSlogan, setDisplayedSlogan] = useState("");
  const [activeTab, setActiveTab] = useState("profile");
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    feedback: "",
    suggestions: ""
  });
  const [selectedTheme, setSelectedTheme] = useState(currentTheme);

  const username = localStorage.getItem("username") || "Guest";

  const content = ` Hey ${username}, are you satisfied with our system? If you want to suggest any changes, just fill out a form. Any updates to your profile can be done by following the steps provided below.`;
  const slogan = " Your Feedback, Our Progress!";

  // Typewriter for main content
  useEffect(() => {
    let index = 0;
    setDisplayedContent(""); 
    const interval = setInterval(() => {
      if (index < content.length) {
        setDisplayedContent((prev) => prev + content.charAt(index));
        index++;
      } else clearInterval(interval);
    }, 50);
    return () => clearInterval(interval);
  }, [content]);

  // Typewriter for slogan
  useEffect(() => {
    let index = 0;
    setDisplayedSlogan("");
    const interval = setInterval(() => {
      if (index < slogan.length) {
        setDisplayedSlogan((prev) => prev + slogan.charAt(index));
        index++;
      } else clearInterval(interval);
    }, 100);
    return () => clearInterval(interval);
  }, [slogan]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: value
    });
  };

  const handleThemeChange = (e) => {
    const value = e.target.value;
    if(value === "auto") {
      const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      setTheme(prefersDark ? "dark" : "light");
      setSelectedTheme("auto");
    } else {
      setTheme(value);
      setSelectedTheme(value);
    }
  };

  async function handleSubmit(e) {
    e.preventDefault();
    try {
      const response = await fetch("http://localhost:5000/api/users/feedback", {
        method: 'POST',
        headers: {'Content-Type':'application/json'},
        body: JSON.stringify(formData)
      });
      if(response.ok) alert("Thank you for your feedback! We'll review your suggestions.");
    } catch(err) {
      alert("Submit Error: " + err);
    }
    setFormData({
      name: "",
      email: "",
      feedback: "",
      suggestions: ""
    });
  }

  useEffect(() => {
    setSelectedTheme(currentTheme);
  }, [currentTheme]);

  return (
    <div className="settings-container">
      <div className="settings-header">
        <p>Customize your experience and provide feedback</p>
      </div>

      <div className="settings-typewriter">
        <p className="settings-typewriter-text">{displayedContent}</p>
        <h2 className="settings-typewriter-slogan">{displayedSlogan}</h2>
      </div>

      <div className="settings-tabs">
        <button 
          className={activeTab === "profile" ? "settings-tab settings-tab-active" : "settings-tab"} 
          onClick={() => setActiveTab("profile")}
        >
          <span className="settings-tab-text">PROFILE SETTINGS</span>
        </button>
        <button 
          className={activeTab === "feedback" ? "settings-tab settings-tab-active" : "settings-tab"} 
          onClick={() => setActiveTab("feedback")}
        >
          <span className="settings-tab-text">FEEDBACK & SUGGESTIONS</span>
        </button>
      </div>

      <div className="settings-content">
        {activeTab === "profile" && (
          <div className="settings-profile">
            <h2 className="settings-subtitle">UPDATE YOUR PROFILE</h2>
            <form className="settings-form">
              <div className="settings-form-group">
                <label htmlFor="username" className="settings-label">USERNAME</label>
                <input 
                  type="text" 
                  id="username" 
                  defaultValue={username}
                  disabled
                  className="settings-input"
                />
              </div>
              <div className="settings-form-group">
                <label htmlFor="email" className="settings-label">EMAIL ADDRESS</label>
                <input 
                  type="email" 
                  id="email" 
                  placeholder="Enter your email"
                  className="settings-input"
                />
              </div>
              <div className="settings-form-group">
                <label htmlFor="password" className="settings-label">NEW PASSWORD</label>
                <input 
                  type="password" 
                  id="password" 
                  placeholder="Enter new password"
                  className="settings-input"
                />
              </div>
              <div className="settings-form-group">
                <label htmlFor="theme" className="settings-label">THEME PREFERENCE</label>
                <select
                  id="theme"
                  className="settings-select"
                  value={selectedTheme}
                  onChange={handleThemeChange}
                >
                  <option value="light">LIGHT</option>
                  <option value="dark">DARK</option>
                  <option value="blue">BLUE</option>
                  <option value="green">GREEN</option>
                  <option value="auto">AUTO (SYSTEM DEFAULT)</option>
                </select>
              </div>
              <button type="submit" className="settings-button">UPDATE PROFILE</button>
            </form>
          </div>
        )}

        {activeTab === "feedback" && (
          <div className="settings-feedback">
            <h2 className="settings-subtitle">WE'D LOVE TO HEAR FROM YOU</h2>
            <form className="settings-form" onSubmit={handleSubmit}>
              <div className="settings-form-group">
                <label htmlFor="name" className="settings-label">YOUR NAME</label>
                <input 
                  type="text" 
                  id="name" 
                  name="name"
                  value={formData.name}
                  onChange={handleInputChange}
                  placeholder="Enter your name"
                  required
                  className="settings-input"
                />
              </div>
              <div className="settings-form-group">
                <label htmlFor="email" className="settings-label">EMAIL ADDRESS</label>
                <input 
                  type="email" 
                  id="email" 
                  name="email"
                  value={formData.email}
                  onChange={handleInputChange}
                  placeholder="Enter your email"
                  required
                  className="settings-input"
                />
              </div>
              <div className="settings-form-group">
                <label htmlFor="feedback" className="settings-label">YOUR FEEDBACK</label>
                <select 
                  id="feedback" 
                  name="feedback"
                  value={formData.feedback}
                  onChange={handleInputChange}
                  required
                  className="settings-select"
                >
                  <option value="">SELECT YOUR SATISFACTION LEVEL</option>
                  <option value="very-satisfied">VERY SATISFIED</option>
                  <option value="satisfied">SATISFIED</option>
                  <option value="neutral">NEUTRAL</option>
                  <option value="unsatisfied">UNSATISFIED</option>
                  <option value="very-unsatisfied">VERY UNSATISFIED</option>
                </select>
              </div>
              <div className="settings-form-group">
                <label htmlFor="suggestions" className="settings-label">SUGGESTIONS FOR IMPROVEMENT</label>
                <textarea 
                  id="suggestions" 
                  name="suggestions"
                  value={formData.suggestions}
                  onChange={handleInputChange}
                  placeholder="What changes would you like to see?"
                  rows="4"
                  required
                  className="settings-textarea"
                ></textarea>
              </div>
              <button type="submit" className="settings-button">SUBMIT FEEDBACK</button>
            </form>
          </div>
        )}
      </div>
      
      <div className="settings-logout-section">
        <p>Logout from your current account</p>
        <button onClick={onLogout} className="settings-logout-btn">
          <FontAwesomeIcon icon={faSignOutAlt} className="settings-logout-icon" /> Logout
        </button>
      </div>
      
      <div className="settings-footer">
        <p>NEED MORE HELP? CONTACT OUR SUPPORT TEAM AT SUPPORT@SMARTY-DASH.COM</p>
      </div>
    </div>
  );
}

export default Setting;
