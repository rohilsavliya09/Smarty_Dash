import React, { useEffect, useState } from 'react';
import List from '../../Dashboard/CretaeList/List';

function Dashboard({ assignedTasks = []})
{
  return (
    <div style={{ padding: 16 }}>
      <List assignedTasks={assignedTasks} />
    </div>
  );
}

export default Dashboard;
