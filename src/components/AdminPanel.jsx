import React, { useEffect, useState } from 'react';
import { supabase } from '../supabase';
import {
  FaSearch, FaSortUp, FaSortDown, FaPlus, FaEdit, FaTrash, FaTimes, FaEye, FaCopy, FaChartLine, FaDownload, FaCog
} from 'react-icons/fa';
import 'tailwindcss/tailwind.css';
import whitetapLogo from '../assets/whitetap.png';
import DatePicker from 'react-datepicker';
import "react-datepicker/dist/react-datepicker.css";
import {
  LineChart,
  Line,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  Legend,
  LabelList
} from 'recharts';
import * as XLSX from 'xlsx';

const getMonthName = (date) => {
  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  return months[date.getMonth()];
};

const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-gray-800 text-white p-2 rounded shadow-lg">
        <p className="font-semibold">{`${label} : ${payload[0].value}`}</p>
      </div>
    );
  }
  return null;
};

const AdminPanel = () => {
  const [salesmen, setSalesmen] = useState([]);
  const [sortOrder, setSortOrder] = useState('asc');
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [showAnalyticsModal, setShowAnalyticsModal] = useState(false);
  const [showFiltersModal, setShowFiltersModal] = useState(false);
  const [selectedSalesman, setSelectedSalesman] = useState(null);
  const [newSalesmanName, setNewSalesmanName] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [copied, setCopied] = useState(false);
  const [startDate, setStartDate] = useState(null);
  const [endDate, setEndDate] = useState(null);
  const [salesmanPerformance, setSalesmanPerformance] = useState([]);

  const client_id = localStorage.getItem('client_id');

  const fetchSalesmen = async () => {
    setLoading(true);
    try {
      const { data: salesmenData, error: salesmenError } = await supabase
        .from('salesmen')
        .select('*')
        .eq('client_id', client_id);

      if (salesmenError) {
        console.error('Error fetching salesmen:', salesmenError);
      } else {
        const pointsData = await Promise.all(salesmenData.map(async (salesman) => {
          const { data: pointsData, error: pointsError } = await supabase
            .from('client_salesman_activity')
            .select('*')
            .eq('salesman_id', salesman.id)
            .eq('client_id', client_id);

          if (pointsError) {
            console.error('Error fetching points:', pointsError);
          }

          const filteredPoints = pointsData.filter(activity => {
            const activityDate = new Date(activity.activity_timestamp);
            return (
              (!startDate || activityDate >= startDate) &&
              (!endDate || activityDate <= new Date(endDate).setHours(23, 59, 59, 999))
            );
          });

          const totalPoints = filteredPoints.length; // Count the number of activities as points
          return { ...salesman, points: totalPoints };
        }));

        // Sort the pointsData before setting it in the state
        const sortedPointsData = pointsData.sort((a, b) => {
          return sortOrder === 'asc' ? a.points - b.points : b.points - a.points;
        });

        setSalesmen(sortedPointsData);
      }
    } catch (error) {
      console.error('Error fetching salesmen:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchClientLogo = async () => {
    try {
      const { data, error } = await supabase
        .from('clients')
        .select('logourl')
        .eq('id', client_id)
        .single();

      if (error) {
        console.error('Error fetching client logo:', error);
      } else {
        setLogoUrl(data.logourl);
      }
    } catch (error) {
      console.error('Error fetching client logo:', error);
    }
  };

  const fetchSalesmanPerformance = async (salesmanId) => {
    const today = new Date();
    const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    try {
      const { data, error } = await supabase
        .from('client_salesman_activity')
        .select('*')
        .eq('salesman_id', salesmanId)
        .eq('client_id', client_id)
        .gte('activity_timestamp', firstDayOfMonth.toISOString());

      if (error) {
        console.error('Error fetching salesman performance:', error);
      } else {
        setSalesmanPerformance(data);
      }
    } catch (error) {
      console.error('Error fetching salesman performance:', error);
    }
  };

  useEffect(() => {
    fetchSalesmen();
    fetchClientLogo();
  }, [sortOrder, startDate, endDate]);

  useEffect(() => {
    const subscription = supabase
      .channel('realtime-salesmen')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'salesmen' },
        (payload) => {
          const { eventType, new: newData, old: oldData } = payload;

          if (eventType === 'INSERT' || eventType === 'UPDATE') {
            setSalesmen((prevSalesmen) => {
              const updatedSalesmen = prevSalesmen.filter(
                (salesman) => salesman.id !== newData.id
              );
              return [...updatedSalesmen, newData];
            });
          } else if (eventType === 'DELETE') {
            setSalesmen((prevSalesmen) =>
              prevSalesmen.filter((salesman) => salesman.id !== oldData.id)
            );
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(subscription);
    };
  }, []);

  const toggleSortOrder = () => {
    setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    const sortedSalesmen = [...salesmen].sort((a, b) => {
      return sortOrder === 'asc' ? b.points - a.points : a.points - b.points;
    });
    setSalesmen(sortedSalesmen);
  };

  const handleAddSalesman = async () => {
    if (newSalesmanName.trim() === '') return;

    try {
      const { data, error } = await supabase
        .from('salesmen')
        .insert([{ name: newSalesmanName, client_id }]);

      if (error) {
        console.error('Error adding salesman:', error);
      } else {
        setNewSalesmanName('');
        setShowAddModal(false);
      }
    } catch (error) {
      console.error('Error adding salesman:', error);
    }
  };

  const handleEditSalesman = async () => {
    if (!selectedSalesman || newSalesmanName.trim() === '') return;

    try {
      const { data, error } = await supabase
        .from('salesmen')
        .update({ name: newSalesmanName })
        .eq('id', selectedSalesman.id);

      if (error) {
        console.error('Error updating salesman:', error);
      } else {
        setSelectedSalesman(null);
        setNewSalesmanName('');
        setShowEditModal(false);
      }
    } catch (error) {
      console.error('Error updating salesman:', error);
    }
  };

  const handleDeleteSalesman = async () => {
    if (!selectedSalesman) return;

    try {
      const { data, error } = await supabase
        .from('salesmen')
        .delete()
        .eq('id', selectedSalesman.id);

      if (error) {
        console.error('Error deleting salesman:', error);
      } else {
        setSelectedSalesman(null);
        setShowDeleteModal(false);
      }
    } catch (error) {
      console.error('Error deleting salesman:', error);
    }
  };

  const handleCopyLink = (salesman) => {
    const link = `https://reviewcard.www.thewhitetap.com/app/${client_id}/${salesman.id}`;
    navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShowAnalytics = async (salesman) => {
    setSelectedSalesman(salesman);
    await fetchSalesmanPerformance(salesman.id);
    setShowAnalyticsModal(true);
  };

  const filteredSalesmen = salesmen.filter((salesman) =>
    salesman.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const clearDates = () => {
    setStartDate(null);
    setEndDate(null);
    setSearchTerm('');
  };

  const filterPerformanceByDate = () => {
    if (!startDate && !endDate) return salesmanPerformance;

    return salesmanPerformance.filter((activity) => {
      const activityDate = new Date(activity.activity_timestamp);
      return (
        (!startDate || activityDate >= startDate) &&
        (!endDate || activityDate <= new Date(endDate).setHours(23, 59, 59, 999))
      );
    });
  };

  const performanceData = filterPerformanceByDate().map((activity) => ({
    date: new Date(activity.activity_timestamp).toLocaleDateString(),
    count: 1,
  }));

  const aggregatedPerformanceData = Object.values(
    performanceData.reduce((acc, { date, count }) => {
      acc[date] = acc[date] || { date, count: 0 };
      acc[date].count += count;
      return acc;
    }, {})
  );

  const handleDownload = () => {
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(
      filteredSalesmen.map(salesman => ({
        Name: salesman.name,
        Points: salesman.points
      }))
    );
    XLSX.utils.book_append_sheet(wb, ws, 'Salesmen Points');
    XLSX.writeFile(wb, 'salesmen_points.xlsx');
  };

  return (
    <div className="min-h-screen p-4 pt-20 bg-gray-50">
      <div className="text-center mt-4 mb-2">
        {logoUrl && (
          <img src={logoUrl} alt="Company Logo" className="mx-auto w-24 h-auto mb-3" />
        )}
        <h1 className="text-3xl font-bold text-gray-800">Review Growth Tracker</h1>
        <p className="text-gray-600 -mt-16 -mb-[68px] ml-[70px]">
          Powered by
          <img src={whitetapLogo} alt="White Tap Logo" className="inline-block w-48 h-auto -ml-12" />
        </p>
      </div>

      <div className="sticky mt-0 top-20 z-10 bg-gray-50 py-4 rounded-lg mb-8">
        {/* Mobile view */}
        <div className="flex    md:hidden items-center md:flex-row md:justify-between p-4">
          <div className="relative flex-grow mb-4 md:mb-0">
            <input
              type="text"
              className="border border-gray-300 rounded-lg py-2 px-4 w-full focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Search"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            <span className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-500">
              <FaSearch />
            </span>
          </div>
          <button
            onClick={() => setShowFiltersModal(true)}
            className="bg-gray-300 text-gray-700 -mt-5 ml-4 px-5 py-3 rounded-lg hover:bg-gray-400 flex items-center"
          >
            <FaCog />
          </button>
        </div>

        {/* Desktop view */}
        <div className="hidden md:flex flex-col md:flex-row md:items-center md:justify-between p-4">
          <div className="flex flex-col md:flex-row md:items-center md:space-x-4 mb-4 md:mb-0 w-full">
            <div className="relative flex-grow mb-4 md:mb-0">
              <input
                type="text"
                className="border border-gray-300 rounded-lg py-2 px-4 w-full focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Search"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
              <span className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-500">
                <FaSearch />
              </span>
            </div>
          </div>
          <div className="flex flex-col md:flex-row md:items-center md:space-x-4 mb-4 md:mb-0 w-full">
            <div className="flex md:ml-4 md:-mt-6 flex-col md:flex-row md:items-center md:space-x-4 mb-4 md:mb-0 w-full">
              <div className="relative flex-grow mb-4 md:mb-0">
                <label className="block text-gray-700 font-semibold mb-1">
                  Start Date:
                </label>
                <DatePicker
                  selected={startDate}
                  onChange={(date) => setStartDate(date)}
                  selectsStart
                  startDate={startDate}
                  endDate={endDate}
                  dateFormat="yyyy-MM-dd"
                  className="border border-gray-300 rounded px-2 py-1 w-full"
                />
              </div>
              <div className="relative flex-grow mb-4 md:mb-0">
                <label className="block text-gray-700 font-semibold mb-1">
                  End Date:
                </label>
                <DatePicker
                  selected={endDate}
                  onChange={(date) => setEndDate(date)}
                  selectsEnd
                  startDate={startDate}
                  endDate={endDate}
                  minDate={startDate}
                  dateFormat="yyyy-MM-dd"
                  className="border border-gray-300 rounded px-2 py-1 w-full"
                />
              </div>
            </div>
          </div>
          <div className="flex flex-col md:ml-5 md:flex-row md:items-center md:space-x-4 w-full">
            <button
              onClick={toggleSortOrder}
              className="bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600 flex items-center"
            >
              {sortOrder === "asc" ? <FaSortUp /> : <FaSortDown />}
              <span className="ml-2">Sort</span>
            </button>
            <button
              onClick={() => setShowAddModal(true)}
              className="bg-green-500 text-white px-4 py-2 rounded-lg hover:bg-green-600 flex items-center"
            >
              <FaPlus className="mr-2" />
              Add
            </button>
            <button
              onClick={handleDownload}
              className="bg-gray-500 text-white px-4 py-2 rounded-lg hover:bg-gray-600 flex items-center"
            >
              <FaDownload className="mr-2" />
              Download
            </button>
            <button
              onClick={clearDates}
              className="bg-red-500 text-white px-4 py-2 rounded-lg hover:bg-red-600 flex items-center"
            >
              Clear
            </button>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center items-center h-64">
          <div className="loader">Loading...</div>
        </div>
      ) : filteredSalesmen.length === 0 ? (
        <div className="text-center text-gray-500">No salesmen found</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredSalesmen.map((salesman) => (
            <div
              key={salesman.id}
              className="bg-white p-6 rounded-lg shadow hover:shadow-xl transition-shadow relative"
            >
              <h2 className="text-xl font-bold text-gray-800">{salesman.name}</h2>
              <p className="text-gray-600">Points: {salesman.points}</p>
              <div className="absolute top-2 right-2 flex space-x-2">
                <button
                  onClick={() => {
                    setSelectedSalesman(salesman);
                    setShowViewModal(true);
                  }}
                  className="text-gray-500 hover:text-gray-700 p-2 rounded-full hover:bg-gray-200 transition"
                >
                  <FaEye />
                </button>
                <button
                  onClick={() => handleShowAnalytics(salesman)}
                  className="text-green-500 hover:text-green-700 p-2 rounded-full hover:bg-green-100 transition"
                >
                  <FaChartLine />
                </button>
                <button
                  onClick={() => {
                    setSelectedSalesman(salesman);
                    setNewSalesmanName(salesman.name);
                    setShowEditModal(true);
                  }}
                  className="text-blue-500 hover:text-blue-700 p-2 rounded-full hover:bg-blue-100 transition"
                >
                  <FaEdit />
                </button>
                <button
                  onClick={() => {
                    setSelectedSalesman(salesman);
                    setShowDeleteModal(true);
                  }}
                  className="text-red-500 hover:text-red-700 p-2 rounded-full hover:bg-red-100 transition"
                >
                  <FaTrash />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
          <div className="bg-white rounded-lg shadow-lg p-6 w-full max-w-md">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold">Add Salesman</h2>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                <FaTimes />
              </button>
            </div>
            <input
              type="text"
              className="border rounded-lg py-2 px-4 w-full mb-4"
              placeholder="Enter salesman name"
              value={newSalesmanName}
              onChange={(e) => setNewSalesmanName(e.target.value)}
            />
            <div className="flex justify-end space-x-2">
              <button
                onClick={() => setShowAddModal(false)}
                className="bg-gray-300 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-400"
              >
                Cancel
              </button>
              <button
                onClick={handleAddSalesman}
                className="bg-green-500 text-white px-4 py-2 rounded-lg hover:bg-green-600"
              >
                Add
              </button>
            </div>
          </div>
        </div>
      )}

      {showEditModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
          <div className="bg-white rounded-lg shadow-lg p-6 w-full max-w-md">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold">Edit Salesman</h2>
              <button
                onClick={() => {
                  setShowEditModal(false);
                  setSelectedSalesman(null);
                  setNewSalesmanName('');
                }}
                className="text-gray-500 hover:text-gray-700"
              >
                <FaTimes />
              </button>
            </div>
            <input
              type="text"
              className="border rounded-lg py-2 px-4 w-full mb-4"
              placeholder="Enter salesman name"
              value={newSalesmanName}
              onChange={(e) => setNewSalesmanName(e.target.value)}
            />
            <div className="flex justify-end space-x-2">
              <button
                onClick={() => {
                  setShowEditModal(false);
                  setSelectedSalesman(null);
                  setNewSalesmanName('');
                }}
                className="bg-gray-300 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-400"
              >
                Cancel
              </button>
              <button
                onClick={handleEditSalesman}
                className="bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
          <div className="bg-white rounded-lg shadow-lg p-6 w-full max-w-md">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold">Delete Salesman</h2>
              <button
                onClick={() => setShowDeleteModal(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                <FaTimes />
              </button>
            </div>
            <p className="mb-4">
              Are you sure you want to delete {selectedSalesman?.name}?
            </p>
            <div className="flex justify-end space-x-2">
              <button
                onClick={() => setShowDeleteModal(false)}
                className="bg-gray-300 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-400"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteSalesman}
                className="bg-red-500 text-white px-4 py-2 rounded-lg hover:bg-red-600"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {showViewModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
          <div className="bg-white rounded-lg shadow-lg p-6 w-full max-w-md">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold">View Salesman</h2>
              <button
                onClick={() => setShowViewModal(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                <FaTimes />
              </button>
            </div>
            <div className="mb-4">
              <p className="text-gray-900">{selectedSalesman?.name}</p>
            </div>
            <div className="mb-4">
              <div className="flex items-center">
                <input
                  type="text"
                  className="border rounded-lg py-2 px-4 w-full"
                  value={`https://reviewcard.www.thewhitetap.com/app/${client_id}/${selectedSalesman?.id}`} 
                  readOnly
                />
                <div className="relative flex items-center">
                  <button
                    onClick={() => handleCopyLink(selectedSalesman)}
                    className="bg-gray-200 text-gray-700 px-2 py-1 ml-2 rounded-lg hover:bg-gray-300"
                  >
                    <FaCopy />
                  </button>
                  {copied && (
                    <div className="absolute left-full ml-2 p-1 bg-emerald-500 text-white rounded-lg shadow">
                      Copied!
                    </div>
                  )}
                </div>
              </div>
            </div>
            <div className="flex justify-end">
              <button
                onClick={() => setShowViewModal(false)}
                className="bg-gray-300 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-400"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {showAnalyticsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
          <div className="relative bg-white rounded-lg shadow-lg w-full max-w-3xl">
            <div className="flex justify-between items-center p-4 border-b">
              <h2 className="text-xl font-bold">{selectedSalesman?.name}&apos;s Performance</h2>
              <button
                onClick={() => setShowAnalyticsModal(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                <FaTimes />
              </button>
            </div>
            <div className="p-6 overflow-y-auto max-h-[80vh]">
              <div className="mb-4 grid grid-cols-1 gap-4 md:grid-cols-4 md:items-end">
                <div>
                  <label htmlFor="startDate" className="block text-gray-700">Start Date:</label>
                  <DatePicker
                    id="startDate"
                    selected={startDate}
                    onChange={(date) => setStartDate(date)}
                    selectsStart
                    startDate={startDate}
                    endDate={endDate}
                    dateFormat="yyyy-MM-dd"
                    className="border border-gray-300 rounded px-2 py-1 w-full"
                  />
                </div>
                <div>
                  <label htmlFor="endDate" className="block text-gray-700">End Date:</label>
                  <DatePicker
                    id="endDate"
                    selected={endDate}
                    onChange={(date) => setEndDate(date)}
                    selectsEnd
                    startDate={startDate}
                    endDate={endDate}
                    minDate={startDate}
                    dateFormat="yyyy-MM-dd"
                    className="border border-gray-300 rounded px-2 py-1 w-full"
                  />
                </div>
                <button
                  onClick={clearDates}
                  className="bg-red-500 text-white px-4 py-2 rounded-lg mb-4 md:-mb-[0px] lg:mb-0"
                >
                  Clear
                </button>
              </div>
              <div className="w-full">
                <h2 className="text-xl font-semibold mb-6 text-gray-800">Performance</h2>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={aggregatedPerformanceData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
                    <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend wrapperStyle={{ fontSize: '14px', marginBottom: '-24px' }} />
                    <Line type="monotone" dataKey="count" stroke="#4c51bf" strokeWidth={3} dot={{ stroke: '#4c51bf', strokeWidth: 2 }} activeDot={{ r: 8 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div className="flex justify-end p-4 border-t">
              <button
                onClick={() => setShowAnalyticsModal(false)}
                className="bg-gray-300 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-400"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {showFiltersModal && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black bg-opacity-50 p-4">
          <div className="bg-white rounded-lg shadow-lg p-6 w-full max-w-md">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold">Filters</h2>
              <button
                onClick={() => setShowFiltersModal(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                <FaTimes />
              </button>
            </div>
            <div className="flex flex-col space-y-4">
              <div className="relative flex-grow mb-4 md:mb-0">
                <label className="block text-gray-700 font-semibold mb-1">
                  Start Date:
                </label>
                <DatePicker
                  selected={startDate}
                  onChange={(date) => setStartDate(date)}
                  selectsStart
                  startDate={startDate}
                  endDate={endDate}
                  dateFormat="yyyy-MM-dd"
                  className="border border-gray-300 rounded px-2 py-1 w-full"
                />
              </div>
              <div className="relative flex-grow mb-4 md:mb-0">
                <label className="block text-gray-700 font-semibold mb-1">
                  End Date:
                </label>
                <DatePicker
                  selected={endDate}
                  onChange={(date) => setEndDate(date)}
                  selectsEnd
                  startDate={startDate}
                  endDate={endDate}
                  minDate={startDate}
                  dateFormat="yyyy-MM-dd"
                  className="border border-gray-300 rounded px-2 py-1 w-full"
                />
              </div>
              <button
                onClick={toggleSortOrder}
                className="bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600 flex items-center"
              >
                {sortOrder === "asc" ? <FaSortUp /> : <FaSortDown />}
                <span className="ml-2">Sort</span>
              </button>
              <button
                onClick={() => setShowAddModal(true)}
                className="bg-green-500 text-white px-4 py-2 rounded-lg hover:bg-green-600 flex items-center"
              >
                <FaPlus className="mr-2" />
                Add
              </button>
              <button
                onClick={handleDownload}
                className="bg-gray-500 text-white px-4 py-2 rounded-lg hover:bg-gray-600 flex items-center"
              >
                <FaDownload className="mr-2" />
                Download
              </button>
              <button
                onClick={clearDates}
                className="bg-red-500 text-white px-4 py-2 rounded-lg hover:bg-red-600 flex items-center"
              >
                Clear
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminPanel;
