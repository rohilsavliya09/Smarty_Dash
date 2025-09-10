import React, { useState, useEffect, useRef } from "react";
import axios from "axios";
import './ListContainer.css';
import { generateId } from '../Utils/Utils';

function nowDateTime() {
  const now = new Date();
  const date = now.toISOString().split("T")[0];
  const time = now.toTimeString().slice(0, 5);
  return { date, time };
}

function ListContainer({ title, onDelete, onRename, initialTasks = [], onTaskMove, listId }) {
  const [task, setTask] = useState("");
  const [taskMinutes, setTaskMinutes] = useState(0);
  const [taskAssignee, setTaskAssignee] = useState("");
  const [tasks, setTasks] = useState(initialTasks || []);
  const [editingTaskId, setEditingTaskId] = useState(null);
  const [editDraft, setEditDraft] = useState({});
  const [showTaskForm, setShowTaskForm] = useState(false);
  const [isDraggingOver, setIsDraggingOver] = useState(false);

  const editInputRef = useRef(null);
  const containerRef = useRef(null);
  const userid = localStorage.getItem("id") || "Guest1234";
  const assignDate = new Date().toISOString().split("T")[0];

  // keep local tasks in sync when parent passes new initialTasks
  useEffect(() => {
    setTasks(Array.isArray(initialTasks) ? initialTasks.map(t => ({
      // normalize shape for UI (preserve existing fields)
      ...t,
      text: t.text || t.task || "",
      timerMs: t.timerMs || 0,
      isRunning: t.isRunning || false,
      lastStartedAt: t.lastStartedAt || null,
      confirmDelete: t.confirmDelete || false,
    })) : []);
  }, [initialTasks]);

  // Drag and drop handlers
  const handleDragStart = (e, task) => {
    e.dataTransfer.setData("task", JSON.stringify(task));
    e.dataTransfer.setData("sourceListId", listId);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDraggingOver(true);
    e.dataTransfer.dropEffect = "move";
  };

  const handleDragEnter = (e) => {
    e.preventDefault();
    setIsDraggingOver(true);
  };

  const handleDragLeave = (e) => {
    // Only set to false if leaving the container, not just moving between children
    if (!containerRef.current.contains(e.relatedTarget)) {
      setIsDraggingOver(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDraggingOver(false);
    
    try {
      const taskData = JSON.parse(e.dataTransfer.getData("task"));
      const sourceListId = e.dataTransfer.getData("sourceListId");
      
      // Only process if dropped on a different list
      if (sourceListId !== listId && onTaskMove) {
        onTaskMove(taskData, sourceListId, listId);
      }
    } catch (error) {
      console.error("Error processing dropped task:", error);
    }
  };

  // --- Add Task ---
  async function handleAddTask() {
    const trimmed = task.trim();
    if (!trimmed) return;
    const { date, time } = nowDateTime();
    const timerMs = Math.max(0, Number(taskMinutes) * 60000);

    const newTask = {
      id: generateId(),
      task: trimmed,
      done: false,
      assigndate: date,
      assigntime: time,
      expiredate: null,
      assignedTo: taskAssignee || "",
      timerMs,
    };

    try {
      // try to persist to backend; ignore failure but warn
      await axios.post(`http://localhost:5000/api/add-task/${userid}`, newTask);
    } catch (err) {
      console.warn("⚠️ Add task failed:", err.message);
    }

    setTasks((prev) => [
      {
        ...newTask,
        text: trimmed,
        isRunning: false,
        lastStartedAt: null,
        confirmDelete: false,
      },
      ...prev,
    ]);

    setTask("");
    setTaskMinutes(0);
    setTaskAssignee("");
    setShowTaskForm(false);
  }

  function handleAddKeyDown(e) {
    if (e.key === "Enter") {
      e.preventDefault();
      handleAddTask();
    }
  }

  // --- Edit Task ---
  function startEditTask(id) {
    const t = tasks.find((t) => t.id === id);
    if (!t) return;
    setEditDraft({
      text: t.text || t.task || "",
      timerMs: t.timerMs || 0,
      assignedTo: t.assignedTo || "",
    });
    setEditingTaskId(id);
  }

  function updateEditDraft(field, value) {
    setEditDraft((prev) => ({ ...prev, [field]: value }));
  }

  async function saveEditTask() {
    if (!editingTaskId) return;
    const updatedText = (editDraft.text || "").trim();
    if (!updatedText) return;

    const updatedTask = {
      task: updatedText,
      timerMs: Number(editDraft.timerMs) || 0,
      assignedTo: editDraft.assignedTo || "",
    };

    try {
      await axios.put(
        `http://localhost:5000/api/edit-task/${userid}/${editingTaskId}`,
        updatedTask
      );
    } catch (err) {
      console.warn("⚠️ Edit task failed:", err.message);
    }

    setTasks((prev) =>
      prev.map((t) =>
        t.id === editingTaskId
          ? { ...t, ...updatedTask, text: updatedText }
          : t
      )
    );
    setEditingTaskId(null);
    setEditDraft({});
  }

  function cancelEdit() {
    setEditingTaskId(null);
    setEditDraft({});
  }

  useEffect(() => {
    if (editingTaskId && editInputRef.current) {
      editInputRef.current.focus();
      const len = editInputRef.current.value.length;
      try {
        editInputRef.current.setSelectionRange(len, len);
      } catch {}
    }
  }, [editingTaskId]);

  function onEditKeyDown(e) {
    if (e.key === "Enter") {
      e.preventDefault();
      saveEditTask();
    } else if (e.key === "Escape") {
      e.preventDefault();
      cancelEdit();
    }
  }

  // --- Delete Task ---
  async function handleDeleteTask(id) {
    const t = tasks.find((t) => t.id === id);
    if (!t) return;

    if (!t.confirmDelete) {
      setTasks((prev) =>
        prev.map((x) => (x.id === id ? { ...x, confirmDelete: true } : x))
      );
      setTimeout(
        () =>
          setTasks((prev) =>
            prev.map((x) => (x.id === id ? { ...x, confirmDelete: false } : x))
          ),
        5000
      );
    } else {
      try {
        await axios.delete(
          `http://localhost:5000/api/delete-task/${userid}/${id}`
        );
      } catch (err) {
        console.warn("⚠️ Delete task failed:", err.message);
      }
      setTasks((prev) => prev.filter((x) => x.id !== id));
    }
  }

  // --- Toggle Done ---
  async function markAsDone(id) {
    setTasks((prev) =>
      prev.map((t) => (t.id === id ? { ...t, done: !t.done } : t))
    );
    try {
      await axios.patch(
        `http://localhost:5000/api/toggle-done/${userid}/${id}`
      );
    } catch (err) {
      console.warn("⚠️ Toggle done failed:", err.message);
      // rollback if API failed
      setTasks((prev) =>
        prev.map((t) => (t.id === id ? { ...t, done: !t.done } : t))
      );
    }
  }

  // --- Timer Logic ---
  function toggleTimer(id) {
    setTasks((prev) =>
      prev.map((t) => {
        if (t.id !== id) return t;
        const curTimer = t.timerMs || 0;
        // if no timer set and not running, ignore
        if (curTimer <= 0 && !t.isRunning) return t;

        if (t.isRunning) {
          // Pause: calculate remaining and stop
          const elapsed = Date.now() - (t.lastStartedAt || Date.now());
          return {
            ...t,
            isRunning: false,
            lastStartedAt: null,
            timerMs: Math.max(0, curTimer - elapsed),
          };
        } else {
          // Start
          return {
            ...t,
            isRunning: true,
            lastStartedAt: Date.now(),
          };
        }
      })
    );
  }

  // update running timers every second to auto-stop when finished
  useEffect(() => {
    const interval = setInterval(() => {
      setTasks((prev) =>
        prev.map((t) => {
          if (t.isRunning && t.lastStartedAt) {
            const remaining = Math.max(
              0,
              (t.timerMs || 0) - (Date.now() - t.lastStartedAt)
            );
            if (remaining <= 0) {
              return { ...t, isRunning: false, lastStartedAt: null, timerMs: 0 };
            }
            return t; // still running
          }
          return t;
        })
      );
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  function formatTime(ms) {
    const total = Math.max(0, Math.floor(ms / 1000));
    const minutes = Math.floor(total / 60)
      .toString()
      .padStart(2, "0");
    const seconds = (total % 60).toString().padStart(2, "0");
    return `${minutes}:${seconds}`;
  }

  function getDisplayMs(t) {
    if (t.isRunning && t.lastStartedAt) {
      return Math.max(0, (t.timerMs || 0) - (Date.now() - t.lastStartedAt));
    }
    return t.timerMs || 0;
  }

  return (
    <div 
      className={`TMS-list ${isDraggingOver ? "drag-over" : ""}`} 
      role="region" 
      aria-label={`${title} task list`}
      ref={containerRef}
      onDragOver={handleDragOver}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <div className="TMS-list-header">
        <h3 className="TMS-list-title">
          {title} <small>({assignDate})</small>
        </h3>
        <div className="TMS-list-actions" role="toolbar" aria-label="List actions">
          <button
            className="TMS-btn TMS-btn-icon TMS-btn-danger"
            onClick={onDelete}
            aria-label="Delete list"
            title="Delete list"
          >
            ×
          </button>
          <button
            className="TMS-btn TMS-btn-icon"
            onClick={onRename}
            aria-label="Rename list"
            title="Rename list"
          >
            ✏️
          </button>
        </div>
      </div>

      {tasks.length > 0 ? (
        <div className="TMS-task-list">
          {tasks.map((t) => {
            const displayMs = getDisplayMs(t);
            return (
              <div
                key={t.id}
                className={`TMS-task ${t.done ? "TMS-task-completed" : ""}`}
                aria-live="polite"
                draggable
                onDragStart={(e) => handleDragStart(e, t)}
              >
                {editingTaskId === t.id ? (
                  <>
                    <input
                      ref={editInputRef}
                      className="TMS-input"
                      value={editDraft.text || ""}
                      onChange={(e) =>
                        updateEditDraft("text", e.target.value)
                      }
                      onKeyDown={onEditKeyDown}
                      aria-label="Edit task text"
                    />
                    <div className="TMS-edit-controls">
                      <input
                        type="number"
                        min="0"
                        className="TMS-input edit-small"
                        value={Math.round((editDraft.timerMs || 0) / 60000)}
                        onChange={(e) =>
                          updateEditDraft(
                            "timerMs",
                            Number(e.target.value || 0) * 60000
                          )
                        }
                        aria-label="Timer minutes"
                        title="Timer (minutes)"
                      />
                      <input
                        className="TMS-input"
                        value={editDraft.assignedTo || ""}
                        onChange={(e) =>
                          updateEditDraft("assignedTo", e.target.value)
                        }
                        placeholder="Assignee"
                        aria-label="Assignee"
                      />
                      <button
                        className="TMS-btn TMS-btn-primary"
                        onClick={saveEditTask}
                        aria-label="Save task"
                        title="Save"
                      >
                        Save
                      </button>
                      <button
                        className="TMS-btn TMS-btn-danger"
                        onClick={cancelEdit}
                        aria-label="Cancel edit"
                        title="Cancel"
                      >
                        Cancel
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="TMS-task-header">
                      <div
                        className={`TMS-task-content ${t.done ? "TMS-task-completed" : ""}`}
                      >
                        {t.text || t.task}
                      </div>
                      <div className="TMS-task-actions" role="group" aria-label="Task actions">
                        <button
                          className="TMS-btn TMS-btn-icon TMS-btn-edit"
                          onClick={() => startEditTask(t.id)}
                          aria-label="Edit task"
                          title="Edit"
                        >
                          ✏️
                        </button>
                        {(t.timerMs || 0) > 0 && (
                          <button
                            className="TMS-btn TMS-btn-icon"
                            onClick={() => toggleTimer(t.id)}
                            aria-label={t.isRunning ? "Pause timer" : "Start timer"}
                            title={t.isRunning ? "Pause" : "Start"}
                          >
                            {t.isRunning ? "⏸️" : "▶️"}
                          </button>
                        )}
                        <button
                          className="TMS-btn TMS-btn-icon"
                          onClick={() => markAsDone(t.id)}
                          style={{
                            background: t.done ? "#f0f9ff" : "#dcfce7",
                            color: t.done ? "#0c4a6e" : "#166534",
                          }}
                          aria-pressed={t.done}
                          aria-label={t.done ? "Mark as not done" : "Mark as done"}
                          title={t.done ? "Undo" : "Done"}
                        >
                          {t.done ? "↩️" : "✅"}
                        </button>
                        <button
                          className={`TMS-btn TMS-btn-icon ${t.confirmDelete ? "TMS-btn-warning" : "TMS-btn-danger"}`}
                          onClick={() => handleDeleteTask(t.id)}
                          aria-label={t.confirmDelete ? "Confirm delete" : "Delete"}
                          title={t.confirmDelete ? "Confirm delete" : "Delete"}
                        >
                          {t.confirmDelete ? "Confirm?" : "🗑️"}
                        </button>
                      </div>
                    </div>

                    {(t.assigndate || t.assignedTo) && (
                      <div className="TMS-task-meta">
                        {t.assigndate && (
                          <span className="TMS-task-date">
                            {t.assigndate}
                            {t.assigntime ? " @ " + t.assigntime : ""}
                          </span>
                        )}
                        {t.assignedTo && (
                          <span className="TMS-task-assignee">
                            {t.assignedTo}
                          </span>
                        )}
                      </div>
                    )}

                    {(t.timerMs || 0) > 0 && (
                      <div
                        className={`TMS-task-timer ${t.isRunning ? "running" : ""}`}
                      >
                        ⏱️ {formatTime(displayMs)} {t.isRunning && "(running)"}
                      </div>
                    )}
                  </>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="TMS-empty-state">
          No tasks yet for this date. Add a task to get started!
        </div>
      )}

      {!showTaskForm && (
        <button
          className="TMS-floating-btn"
          onClick={() => setShowTaskForm(true)}
          aria-label="Add task"
          title="Add Task"
        >
          +
        </button>
      )}

      {showTaskForm && (
        <div className="TMS-task-form-inline">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleAddTask();
            }}
            className="TMS-form"
          >
            <input
              type="text"
              className="TMS-input"
              placeholder="Your Creative Task"
              value={task}
              onChange={(e) => setTask(e.target.value)}
              onKeyDown={handleAddKeyDown}
              autoFocus
              aria-label="New task"
            />
            <div className="TMS-form-row">
              <input
                type="number"
                min="0"
                className="TMS-input TMS-input-sm"
                value={taskMinutes}
                onChange={(e) => setTaskMinutes(Number(e.target.value) || 0)}
                placeholder="Minutes"
                aria-label="Minutes"
              />
              <input
                value={taskAssignee}
                onChange={(e) => setTaskAssignee(e.target.value)}
                placeholder="Task description (optional)"
                className="TMS-input"
                aria-label="Task description"
              />
            </div>
            <div className="TMS-form-actions">
              <button
                type="button"
                className="TMS-btn"
                onClick={() => setShowTaskForm(false)}
              >
                Cancel
              </button>
              <button type="submit" className="TMS-btn TMS-btn-primary">
                Add Task
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

export default ListContainer;