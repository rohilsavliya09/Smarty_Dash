import React, { useState, useEffect } from "react";
import './List.css';
import ListContainer from "../ListContainer/ListContainer";
import axios from "axios";

function List({ assignedTasks = [] }) {
  const [showlistdoc, setshowlistdoc] = useState(false);
  const [listName, setListName] = useState("");
  const [lists, setLists] = useState([{ name: "Today", tasks: [] }]); // default Today list
  const [error, setError] = useState("");

  const [isRenaming, setIsRenaming] = useState(false);
  const [renameIndex, setRenameIndex] = useState(null);
  const [renameValue, setRenameValue] = useState("");

  const [activeTab, setActiveTab] = useState("today"); // tabs: today / assigned
  const [assignedTabTasks, setAssignedTabTasks] = useState([]); // mirror assignedTasks for reactivity

  const userid = localStorage.getItem("id") || "Guest1234";

  // Load lists from localStorage on mount
  useEffect(() => {
    const savedLists = localStorage.getItem(`lists_${userid}`);
    if (savedLists) {
      try {
        const parsedLists = JSON.parse(savedLists);
        setLists(parsedLists);
      } catch (error) {
        console.error("Error parsing saved lists:", error);
      }
    }
  }, [userid]);

  // Save lists to localStorage whenever they change
  useEffect(() => {
    localStorage.setItem(`lists_${userid}`, JSON.stringify(lists));
  }, [lists, userid]);

  // ✅ Fetch tasks for Today list on mount (fills lists[0].tasks)
  useEffect(() => {
    async function fetchTodayTasks() {
      try {
        const res = await axios.get(`http://localhost:5000/api/tasks/${userid}`);
        // ensure we only set the Today list's tasks (don't overwrite other lists)
        setLists(prev => {
          const copy = Array.isArray(prev) ? [...prev] : [{ name: "Today", tasks: [] }];
          // ensure first item exists and is Today
          if (!copy[0] || copy[0].name !== "Today") {
            copy.unshift({ name: "Today", tasks: res.data || [] });
          } else {
            copy[0] = { ...copy[0], tasks: res.data || [] };
          }
          return copy;
        });
      } catch (err) {
        console.error("⚠️ Error fetching Today tasks:", err.message);
      }
    }
    fetchTodayTasks();
  }, [userid]);

  // Sync assignedTasks from props (keep as separate array)
  useEffect(() => {
    setAssignedTabTasks(Array.isArray(assignedTasks) ? assignedTasks : []);
  }, [assignedTasks]);

  // handle List popup open
  function handlelist() {
    setError("");
    setshowlistdoc(true);
  }

  function handleCreateList() {
    const trimmed = listName.trim();
    if (trimmed === "") return setError("⚠️ List name cannot be empty");

    const exists = lists.some((l) => l.name.toLowerCase() === trimmed.toLowerCase());
    if (exists) return setError("⚠️ This list already exists!");

    setLists([...lists, { name: trimmed, tasks: [] }]);
    setListName("");
    setError("");
    setshowlistdoc(false);
  }

  function handleRenameList() {
    const trimmed = renameValue.trim();
    if (trimmed === "") return setError("⚠️ List name cannot be empty");

    const exists = lists.some((l, idx) => l.name.toLowerCase() === trimmed.toLowerCase() && idx !== renameIndex);
    if (exists) return setError("⚠️ This list already exists!");

    const updatedLists = [...lists];
    updatedLists[renameIndex].name = trimmed;
    setLists(updatedLists);

    setIsRenaming(false);
    setRenameIndex(null);
    setRenameValue("");
    setError("");
  }

  function deleteList(index) {
    const updatedLists = [...lists];
    updatedLists.splice(index, 1);
    setLists(updatedLists);
  }

  // Handle task movement between lists
  function handleTaskMove(task, sourceListId, targetListId) {
    // Find the source and target lists
    const sourceListIndex = lists.findIndex(list => list.name === sourceListId);
    const targetListIndex = lists.findIndex(list => list.name === targetListId);
    
    if (sourceListIndex === -1 || targetListIndex === -1) return;
    
    // Create a deep copy of the task to avoid reference issues
    const taskCopy = JSON.parse(JSON.stringify(task));
    
    // Remove task from source list
    const updatedLists = [...lists];
    updatedLists[sourceListIndex].tasks = updatedLists[sourceListIndex].tasks.filter(t => t.id !== task.id);
    
    // Add task to target list (check if it already exists to prevent duplicates)
    const taskExists = updatedLists[targetListIndex].tasks.some(t => t.id === task.id);
    if (!taskExists) {
      updatedLists[targetListIndex].tasks = [...updatedLists[targetListIndex].tasks, taskCopy];
    }
    
    setLists(updatedLists);
    
    
  }

  return (
    <div className="app-container">
      <div className="TD-container">
        <button className="TD-List-button" onClick={handlelist}>
          <span className="TD-List-button-icon">+</span>
        </button>

        {/* Create Popup */}
        {showlistdoc && (
          <div className="popup">
            <div className="popup-content">
              <h3>Create New List</h3>
              {error && <p style={{ color: "red" }}>{error}</p>}
              <input
                type="text"
                placeholder="Enter list name"
                value={listName}
                onChange={(e) => setListName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleCreateList()}
                autoFocus
              />
              <div className="popup-actions">
                <button onClick={handleCreateList}>Create</button>
                <button onClick={() => setshowlistdoc(false)}>Cancel</button>
              </div>
            </div>
          </div>
        )}

        {/* Rename Popup */}
        {isRenaming && (
          <div className="popup">
            <div className="popup-content">
              <h3>Rename List</h3>
              {error && <p style={{ color: "red" }}>{error}</p>}
              <input
                type="text"
                placeholder="Enter new name"
                value={renameValue}
                onChange={(e) => setRenameValue(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleRenameList()}
                autoFocus
              />
              <div className="popup-actions">
                <button onClick={handleRenameList}>Save</button>
                <button onClick={() => setIsRenaming(false)}>Cancel</button>
              </div>
            </div>
          </div>
        )}

        {/* Tabs for Today list - Placed outside the mapping */}
        <div className="tab-buttons">
          <button
            className={activeTab === "today" ? "active-tab" : ""}
            onClick={() => setActiveTab("today")}
          >
            Today Tasks
          </button>
          <button
            className={activeTab === "assigned" ? "active-tab" : ""}
            onClick={() => setActiveTab("assigned")}
          >
            Assigned Tasks
          </button>
        </div>

        {/* Show Created Lists */}
        <div className="lists-container">
          {lists.map((list, index) => (
            <div key={index} className="list-wrapper">
              <ListContainer
                title={list.name}
                onDelete={() => deleteList(index)}
                onRename={() => {
                  setIsRenaming(true);
                  setRenameIndex(index);
                  setRenameValue(list.name);
                  setError("");
                }}
                initialTasks={
                  list.name === "Today"
                    ? activeTab === "assigned"
                      ? assignedTabTasks
                      : list.tasks
                    : list.tasks
                }
                onTaskMove={handleTaskMove}
                listId={list.name}
              />
            </div>
          ))}
        </div>

        {lists.length === 0 && (
          <div className="empty-state">
            <p>No lists created yet. Create your first list to get started!</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default List;