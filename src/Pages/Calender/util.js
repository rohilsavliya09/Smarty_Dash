

// Generate Uid For Specific Task
export const genId = () => {
    if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
    const rnd = Math.random().toString(36).slice(2, 8);
    return "t_" + Date.now().toString(36) + "_" + rnd;
  };



// Cuurent Date or Time
export const nowDateTime = () => {
      const now = new Date();
      return {
        date: now.toISOString().split("T")[0],
        time: now.toTimeString().split(" ")[0].slice(0, 5),
      };
    };
  