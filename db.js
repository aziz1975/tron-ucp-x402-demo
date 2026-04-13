const fs = require('fs');
const path = require('path');

const DB_FILE = path.join(__dirname, 'orders.json');

// Initialize DB if it doesn't exist
if (!fs.existsSync(DB_FILE)) {
  fs.writeFileSync(DB_FILE, JSON.stringify([]));
}

const getOrders = () => {
  const data = fs.readFileSync(DB_FILE, 'utf8');
  return JSON.parse(data);
};

const saveOrders = (orders) => {
  fs.writeFileSync(DB_FILE, JSON.stringify(orders, null, 2));
};

const createOrder = (order) => {
  const orders = getOrders();
  orders.push(order);
  saveOrders(orders);
  return order;
};

const getOrderById = (id) => {
  const orders = getOrders();
  return orders.find(o => o.id === id);
};

const updateOrder = (id, updates) => {
  const orders = getOrders();
  const index = orders.findIndex(o => o.id === id);
  if (index !== -1) {
    orders[index] = { ...orders[index], ...updates };
    saveOrders(orders);
    return orders[index];
  }
  return null;
};

module.exports = {
  getOrders,
  createOrder,
  getOrderById,
  updateOrder
};
