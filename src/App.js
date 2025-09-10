import React, { useEffect, useState } from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import Login from './Core-Component/Login/Login';
import ProtectedRoute from './ProtectedRoute';
import Calendar from './Pages/Calender/Calender';
import Header from './Core-Component/Header/Header';
import Setting from './Pages/Setting/Setting';
import './App.css';
import Dashboard from './Pages/Dashboard/Dashboard';
import Project from './Pages/Projects/Projects';

function App() {
  const [userData, setUserData] = useState(null);

  const [assignedTasks, setAssignedTasks] = useState(() => {
    try {
      const saved = localStorage.getItem("assignedTasks");
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Theme
  const [theme, setTheme] = useState(localStorage.getItem("theme") || "light");

  useEffect(() => {
    document.body.classList.remove("light-theme", "dark-theme", "blue-theme", "green-theme");
    document.body.classList.add(theme + "-theme");
    localStorage.setItem("theme", theme);
  }, [theme]);

  useEffect(() => {
    const saved = localStorage.getItem("userData");
    if (saved) setUserData(JSON.parse(saved));
  }, []);

  // persist assignedTasks
  useEffect(() => {
    try {
      localStorage.setItem("assignedTasks", JSON.stringify(assignedTasks));
    } catch {}
  }, [assignedTasks]);

  // Helpers to mutate assignedTasks (always create new arrays)
  function addAssignedTask(task, originalDate = null) {
    setAssignedTasks(prev => {
      if (!task || !task.id) return prev;
      if (prev.find(t => t.id === task.id)) return prev;
      return [...prev, { ...task, originalDate }];
    });
  }

  function removeAssignedTask(taskId) {
    setAssignedTasks(prev => prev.filter(t => t.id !== taskId));
  }

  function updateAssignedTask(updatedTask) {
    if (!updatedTask || !updatedTask.id) return;
    setAssignedTasks(prev => prev.map(t => (t.id === updatedTask.id ? { ...t, ...updatedTask } : t)));
  }

  function handleLoginSuccess(user) {
    setUserData(user);
    localStorage.setItem("userData", JSON.stringify(user));
    localStorage.setItem("username", user.name || "User");
  }

  const handleLogout = () => {
    setUserData(null);
    localStorage.removeItem("userData");
    localStorage.removeItem("username");
  };

  return (
    <Router>
      <div className="app">
        {userData && <Header onLogout={handleLogout} />}

        {!userData && (
          <Login isOpen={true} onLoginSuccess={handleLoginSuccess} />
        )}

        <Routes>
          <Route
            path="/calendar"
            element={
              <ProtectedRoute userData={userData}>
                <Calendar
                  assignedTasks={assignedTasks}
                  addAssignedTask={addAssignedTask}
                  removeAssignedTask={removeAssignedTask}
                  updateAssignedTask={updateAssignedTask}
                />
              </ProtectedRoute>
            }
          />
          <Route
            path="/dashboard"
            element={
              <Dashboard
                assignedTasks={assignedTasks}
                addAssignedTask={addAssignedTask}
                removeAssignedTask={removeAssignedTask}
              />
            }
          />
          <Route path="/Project" element={<Project />} />
          <Route
            path="/setting"
            element={
              <ProtectedRoute userData={userData}>
                <Setting
                  onLogout={handleLogout}
                  currentTheme={theme}
                  setTheme={setTheme}
                />
              </ProtectedRoute>
            }
          />
          <Route
            path="/"
            element={userData ? <Navigate to="/dashboard" replace /> : <div />}
          />
        </Routes>
      </div>
    </Router>
  );
}

export default App;

