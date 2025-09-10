# 📌 Smarty-Dash  

**Smarty-Dash** is a **MERN stack-based Task & Project Management System**.  
It provides **Task Management, Project Tracking, Calendar Integration, User Authentication with OTP, Timers, and Customizable Settings** — all in one platform.  

---

## 🚀 Features  

- 🔑 **User Authentication**  
  - Secure login & registration with OTP verification  
  - Forgot / Reset password flow  
  - JWT-based session management  

- ✅ **Task Management**  
  - Create, edit, and delete tasks  
  - Set due dates & assign tasks to users  
  - Mark tasks as complete / undo  
  - Drag & drop between lists  
  - Built-in task timer (start, pause, auto-finish)  

- 📂 **Project Management**  
  - Create & manage multiple projects  
  - View project-specific tasks  
  - Assign collaborators  

- 📅 **Calendar Integration**  
  - Monthly task view  
  - Highlight tasks by due date  
  - Navigate across months  

- ⚙️ **Settings Page**  
  - Light/Dark/Custom theme support  
  - Profile and feedback management  

- 🖥️ **Dashboard**  
  - Personalized greeting  
  - Quick access to Projects, Calendar, and Settings  

---

## 🛠️ Tech Stack  

- **Frontend:** React.js (Hooks, React Router, Custom CSS)  
- **Backend:** Node.js, Express.js  
- **Database:** MongoDB (via Mongoose)  
- **Authentication:** JWT + OTP (Nodemailer)  
- **Utilities:** Axios, bcryptjs, morgan  

---



## 🔑 Environment Variables  

Create a `.env` file in the **backend root**:  

```env
PORT=5000
MONGODB_URI=mongodb://127.0.0.1:27017/smarty
JWT_SECRET=mySuperSecret123!
EMAIL_USER=your-email@gmail.com
EMAIL_PASS=your-app-password
NODE_ENV=development
```

> ⚠️ Use a Gmail **App Password** for `EMAIL_PASS` (regular Gmail password will not work).  

---

## ⚙️ Installation & Setup  

### 1️⃣ Clone Repository  
```bash
git clone https://github.com/rohilsavliya09/Smarty_Dash.git
cd smarty-dash
```

### 2️⃣ Backend Setup  
```bash
cd Connection
node Server.js
```

### 3️⃣ Frontend Setup  
```bash
npm install
npm start
```


## 🧪 Usage  

- Open **http://localhost:3000/** in your browser  
- Register / Login with OTP verification  
- Create new Projects and Tasks  
- Use the Dashboard for quick navigation  
- View tasks and deadlines in the Calendar  

---

## 👨‍💻 Author  

Developed by **Rohil Savaliya (Smarty-Dash Project)** 💡  



A modern MERN stack Task & Project Management System with secure OTP authentication, smart task scheduling, drag-and-drop workflow, calendar integration, real-time timers, and customizable themes.