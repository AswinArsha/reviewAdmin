import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { FaBars, FaTimes } from "react-icons/fa";
import { motion, AnimatePresence } from "framer-motion";
import 'tailwindcss/tailwind.css';

const Navbar = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const [showNavbar, setShowNavbar] = useState(true);

  useEffect(() => {
    setShowNavbar(!location.pathname.startsWith('/admin-login'));
  }, [location.pathname]);

  const handleLogout = () => {
    localStorage.removeItem('adminLoggedIn');
    navigate('/admin-login');
  };

  const toggleMenu = () => {
    setMenuOpen(!menuOpen);
  };

  const isActive = (path) => location.pathname === path ? 'bg-gray-100 text-gray-700' : 'text-gray-100 hover:bg-gray-100 hover:text-gray-700';

  if (!showNavbar) return null;

  return (
    <nav className="bg-gray-900 text-white py-4 shadow-md fixed w-full z-20">
      <div className="container mx-auto flex justify-between items-center px-4 md:px-0">
        <div className="text-2xl font-bold tracking-wide">
          <p className="flex items-center">
            Admin Dashboard
          </p>
        </div>
        <div className="hidden md:flex space-x-6 items-center">
          <Link to="/admin-panel" className={`rounded-lg px-4 py-2 transition duration-300 ${isActive('/admin-panel')}`}>
            Home
          </Link>
          <Link to="/analytics" className={`rounded-lg px-4 py-2 transition duration-300 ${isActive('/analytics')}`}>
            Analytics
          </Link>
          <button
            onClick={handleLogout}
            className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-lg transition duration-300"
          >
            Logout
          </button>
        </div>
        <div className="md:hidden">
          <button onClick={toggleMenu} className="text-white focus:outline-none">
            {menuOpen ? <FaTimes size={24} /> : <FaBars size={24} />}
          </button>
        </div>
      </div>
      <AnimatePresence>
        {menuOpen && (
          <motion.div
            initial={{ opacity: 0, y: -50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -50 }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            className="md:hidden bg-gray-800 border-t border-gray-700 mt-4 absolute w-full z-20"
          >
            <div className="flex flex-col items-center space-y-4 py-4">
              <Link to="/admin-panel" className={`block text-center rounded-lg px-4 py-2 transition duration-300 ${isActive('/admin-panel')}`}>
                Home
              </Link>
              <Link to="/analytics" className={`block text-center rounded-lg px-4 py-2 transition duration-300 ${isActive('/analytics')}`}>
                Analytics
              </Link>
              <button
                onClick={handleLogout}
                className="text-center bg-red-500 hover:bg-red-600 text-white px-24 py-2 rounded-lg transition duration-300"
              >
                Logout
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
};

export default Navbar;
