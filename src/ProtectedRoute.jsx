import { Navigate } from "react-router-dom";

const ProtectedRoute = ({ userData, children }) => {
  if (!userData) {
    return <Navigate to="/" replace />;  // agar login nahi hua to login pe bhej de
  }
  return children; // agar login hai to andar ke component render kar
};

export default ProtectedRoute;
