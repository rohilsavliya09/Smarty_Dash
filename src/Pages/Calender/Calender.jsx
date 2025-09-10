

import { useState, useEffect } from "react";
import './Calender.css';
import axios from "axios";
import { genId, nowDateTime } from "./util";

function Calendar({ assignedTasks = [], addAssignedTask, removeAssignedTask }) {
  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth(); // 0-indexed
  const todayDate = today.getDate();

  const monthName = today.toLocaleString(undefined, { month: "long" });
  const lastOfMonth = new Date(year, month + 1, 0);
  const daysInMonth = lastOfMonth.getDate();

  const pad = (n) => (n < 10 ? '0' + n : String(n));
  const makeLocalKey = (y, m0, d) => `${y}-${pad(m0 + 1)}-${pad(d)}`;
  const todayKey = makeLocalKey(today.getFullYear(), today.getMonth(), today.getDate());

  const dates = Array.from(
    { length: daysInMonth - todayDate + 1 },
    (_, i) => {
      const day = todayDate + i;
      const dateKey = makeLocalKey(year, month, day);
      return { day, dateKey };
    }
  );

  function normalizeDateKey(dateStr) {
    if (!dateStr) return dateStr;
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return dateStr;
    const d = new Date(dateStr);
    if (Number.isNaN(d.getTime())) return dateStr;
    return makeLocalKey(d.getFullYear(), d.getMonth(), d.getDate());
  }

  const [activeDate, setActiveDate] = useState(null);
  const [tasks, setTasks] = useState({});
  const [newTask, setNewTask] = useState("");

  const id = localStorage.getItem("id") || "Guest1234";

  // Fetch tasks grouped by assigndate
  useEffect(() => {
    async function fetchTasks() {
      try {
        const resp = await axios.get(`http://localhost:5000/api/get-tasks/${id}`);
        if (resp.data?.tasks) {
          const grouped = {};
          resp.data.tasks.forEach(t => {
            const key = normalizeDateKey(t.assigndate);
            if (!grouped[key]) grouped[key] = [];
            grouped[key].push({ ...t, assigndate: key });
          });
          setTasks(grouped);
        }
      } catch (err) {
        console.error("❌ Error fetching tasks", err);
      }
    }
    fetchTasks();
  }, [id]);

  // Auto-clean expired tasks every second (keeps UI tidy)
  useEffect(() => {
    const interval = setInterval(() => {
      const now = new Date();
      setTasks(prev => {
        const updated = {};
        for (const date in prev) {
          updated[date] = (prev[date] || []).filter(task => {
            if (task.done && task.expiredate) {
              return new Date(task.expiredate) > now;
            }
            return true;
          });
        }
        return updated;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // DRAG / DROP
  const handleCalendarDragStart = (e, dateStr) => {
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", JSON.stringify({ type: "calendar", date: dateStr }));
  };

  const handleTaskDragStart = (e, task, dateStr) => {
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", JSON.stringify({ type: "task", task, date: dateStr }));
  };

  const handleLeftDrop = (e) => {
    e.preventDefault();
    const raw = e.dataTransfer.getData("text/plain");
    if (!raw) return;
    try {
      const obj = JSON.parse(raw);
      if (obj.type === "task" && obj.task) {
        // add to assignedTasks (calls App.addAssignedTask)
        addAssignedTask(obj.task, obj.date || obj.task.assigndate || null);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleMiddleDrop = async (e) => {
    e.preventDefault();
    const raw = e.dataTransfer.getData("text/plain");
    // if a calendar date was dropped, set activeDate
    try {
      if (!raw) return;
      const obj = JSON.parse(raw);
      if (obj.type === "calendar") {
        const calendarDateStr = obj.date;
        setActiveDate(calendarDateStr);
        setTasks(prev => (prev[calendarDateStr] ? prev : { ...prev, [calendarDateStr]: [] }));
        setNewTask("");
        return;
      }
      if (obj.type === "task") {
        // dropping a task (either from a date or from assignedTasks) into middle -> assign to a date
        const { task, date: fromDate } = obj;
        const targetDate = activeDate || fromDate;
        if (!targetDate) return;

        // Save to backend
        try {
          const taskToSave = {
            ...task,
            assigndate: targetDate,
          };
          // If task came from assignedTasks, POST to /add-task to create on that date
          await axios.post(`http://localhost:5000/api/add-task/${id}`, taskToSave);
        } catch (err) {
          console.warn("❌ Add task failed (drop):", err.message);
        }

        // Add to local tasks state
        setTasks(prev => {
          const list = prev[targetDate] || [];
          if (list.find(t => t.id === task.id)) return prev;
          return { ...prev, [targetDate]: [...list, { ...task, assigndate: targetDate }] };
        });

        // If task was in assignedTasks, remove from assignedTasks
        // (call App removeAssignedTask)
        if (task && task.id) removeAssignedTask(task.id);
      }
    } catch (err) {
      console.error("drop parse error", err);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };

  // Add new task via inline form (saves via backend)
  async function handleAddTask(e) {
    e?.preventDefault();
    if (!activeDate || newTask.trim() === "") return;

    const { time } = nowDateTime();
    const taskObj = {
      id: genId(),
      task: newTask.trim(),
      done: false,
      assigndate: activeDate,
      assigntime: time,
      expiredate: null
    };

    try {
      const resp = await axios.post(`http://localhost:5000/api/add-task/${id}`, taskObj);
      const savedTaskRaw = resp.data?.tasks?.find(t => t.id === taskObj.id) || taskObj;
      const savedTask = { ...savedTaskRaw, assigndate: normalizeDateKey(savedTaskRaw.assigndate) };

      setTasks(prev => ({
        ...prev,
        [activeDate]: [...(prev[activeDate] || []), savedTask]
      }));
      setNewTask("");
    } catch (err) {
      console.error(err);
      alert("❌ Task Not Added: " + (err.response?.data?.error || err.message));
    }
  }

  const handleDeleteTask = async (date, taskId) => {
    try {
      await axios.delete(`http://localhost:5000/api/delete-task/${id}/${taskId}`);
      setTasks(prev => ({
        ...prev,
        [date]: (prev[date] || []).filter(t => t.id !== taskId)
      }));
    } catch (err) {
      console.error("❌ Error deleting task", err);
    }
  };

  const handleToggleDone = async (date, taskId) => {
    setTasks(prev => {
      const updatedList = (prev[date] || []).map(t => {
        if (t.id === taskId) {
          if (!t.done) {
            const expire = new Date();
            expire.setHours(expire.getHours() + 1);
            return { ...t, done: true, expiredate: expire.toISOString() };
          }
          return { ...t, done: false, expiredate: null };
        }
        return t;
      });

      const updatedTask = updatedList.find(t => t.id === taskId);
      axios.put(`http://localhost:5000/api/update-task/${id}/${taskId}`, updatedTask).catch(err => console.error("❌ Error updating task", err));

      return { ...prev, [date]: updatedList };
    });
  };

  return (
    <div className="CR-container">
      {/* Left: Assigned Tasks */}
      <div className="CR-section CR-left" onDrop={handleLeftDrop} onDragOver={handleDragOver}>
        <h2 className="CR-heading CR-heading-purple">Assigned Tasks</h2>
        {(!assignedTasks || assignedTasks.length === 0) ? (
          <p className="CR-text-sm CR-text-gray">Drag tasks here from the middle section to assign them to a date.</p>
        ) : (
          <div className="CR-task-list">
            {assignedTasks.map(t => (
              <div key={t.id} className="CR-assigned-task CR-animate-fadeIn" draggable onDragStart={e => handleTaskDragStart(e, t, t.originalDate || t.assigndate)}>
                <div className="CR-flex CR-justify-between CR-items-start CR-gap-2">
                  <div>
                    <div className="CR-text-sm CR-text-gray CR-text-semibold">Date: {t.originalDate || t.assigndate}</div>
                    <div className="CR-text-sm CR-text-light CR-mt-1">{t.task}</div>
                    <div className="CR-text-xs CR-text-gray CR-mono CR-mt-2">ID: {t.id}</div>
                  </div>
                  <button
                    onClick={() => removeAssignedTask(t.id)}
                    className="CR-icon-button CR-delete-button"
                    title="Cancel task"
                  >
                    ✕
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Middle: Tasks for selected date */}
      <div className="CR-section CR-middle">
        <h2 className="CR-heading CR-heading-cyan">Tasks</h2>
        <div className="CR-task-container" onDrop={handleMiddleDrop} onDragOver={handleDragOver}>
          {!activeDate ? (
            <div className="CR-task-placeholder">
              <div className="CR-placeholder-icon">＋</div>
              <div className="CR-mt-2">Add your new task — first drag a date from the calendar</div>
              <div className="CR-text-sm CR-mt-1 CR-text-gray">Or drop a date into this rectangle to start</div>
            </div>
          ) : (
            <div>
              <div className="CR-flex CR-items-center CR-justify-between CR-mb-3">
                <p className="CR-text-semibold" style={{color: '#67e8f9'}}>Date: {activeDate}</p>
                <span className="CR-text-xs CR-text-gray">{(tasks[activeDate] || []).length} task(s)</span>
              </div>

              <div className="CR-input-group">
                <input
                  type="text"
                  value={newTask}
                  onChange={e => setNewTask(e.target.value)}
                  placeholder="Enter new task..."
                  className="CR-input"
                  onKeyPress={e => e.key === 'Enter' && handleAddTask(e)}
                />
                <button onClick={handleAddTask} className="CR-button">Add</button>
              </div>

              <ul className="CR-task-list">
                {(tasks[activeDate] || []).length === 0 && (
                  <div className="CR-text-sm CR-text-gray">No tasks yet — add one above or drag from elsewhere.</div>
                )}
                {(tasks[activeDate] || []).map(task => (
                  <li key={task.id} draggable onDragStart={e => handleTaskDragStart(e, task, activeDate)} className="CR-task-item CR-animate-fadeIn">
                    <div className="CR-task-content">
                      <div className={task.done ? "CR-line-through CR-text-gray" : "CR-text-semibold"}>{task.task}</div>
                      <div className="CR-text-xs CR-text-gray CR-mono">ID: {task.id}</div>
                    </div>
                    <div className="CR-task-actions">
                      <button
                        onClick={() => handleToggleDone(activeDate, task.id)}
                        className="CR-icon-button CR-done-button"
                        title={task.done ? "Mark as not done" : "Mark as done"}
                      >
                        {task.done ? "↺" : "✓"}
                      </button>
                      <button
                        onClick={() => handleDeleteTask(activeDate, task.id)}
                        className="CR-icon-button CR-delete-button"
                        title="Delete task"
                      >
                        ✕
                      </button>
                      <button
                        onClick={() => addAssignedTask(task, activeDate)}
                        className="CR-icon-button"
                        title="Assign to assigned list"
                      >
                        ➜
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>

      {/* Right: Calendar */}
      <div className="CR-section CR-right">
        <div className="CR-calendar-header">
          <h2 className="CR-calendar-title">{monthName} {year}</h2>
          <p className="CR-text-sm CR-text-gray">Drag any date into the left or middle column</p>
        </div>

        <div className="CR-calendar-grid">
          {dates.map(({ day, dateKey }) => {
            const isToday = dateKey === todayKey;
            const count = (tasks[dateKey] || []).length;

            return (
              <div
                key={dateKey}
                draggable
                onDragStart={e => handleCalendarDragStart(e, dateKey)}
                className={`CR-calendar-day ${isToday ? 'CR-today' : ''}`}
                title={count ? `${count} task(s)` : 'No tasks'}
              >
                <div className="CR-day-number">{day}</div>
                {count > 0 && <div className="CR-task-count">{count} task{count > 1 ? 's' : ''}</div>}
                {isToday && <span className="CR-today-badge">Today</span>}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default Calendar;
